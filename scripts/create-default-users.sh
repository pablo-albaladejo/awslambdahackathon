#!/bin/bash

# Ensure required environment variables are set
if [ -z "$USER_POOL_ID" ] || [ -z "$TEMP_PASSWORD_SECRET_ID" ] || [ -z "$DEFAULT_USER_EMAIL_BASE" ] || [ -z "$AWS_REGION" ]; then
  echo "❌ Error: Missing required environment variables."
  exit 1
fi

echo "🚀 Starting creation of default users..."

# Define users to create
USERS_TO_CREATE=(
  "admin_user:Admins"
  "user_one:Users"
  "user_two:Users"
)

# 1. Get the temporary password from Secrets Manager
echo "🤫 Fetching temporary password from Secrets Manager..."
TEMPORARY_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "$TEMP_PASSWORD_SECRET_ID" \
  --query SecretString \
  --output text \
  --region "$AWS_REGION")

if [ -z "$TEMPORARY_PASSWORD" ]; then
  echo "❌ Error: Could not retrieve temporary password."
  exit 1
fi
echo "✅ Temporary password fetched successfully."

# 2. Loop through users and create them
for user_info in "${USERS_TO_CREATE[@]}"; do
  USERNAME=$(echo "$user_info" | cut -d: -f1)
  GROUP=$(echo "$user_info" | cut -d: -f2)
  USER_EMAIL=$(echo "$DEFAULT_USER_EMAIL_BASE" | sed "s/@/+${USERNAME}@/")

  echo -e "\n--- Processing user: ${USERNAME} (${USER_EMAIL}) ---"

  # 2.1. Create user
  echo "Attempting to create user \"${USERNAME}\"..."

  # Suppress stderr to handle existing user case gracefully
  aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$USER_EMAIL" \
    --temporary-password "$TEMPORARY_PASSWORD" \
    --user-attributes Name=email,Value="$USER_EMAIL" Name=email_verified,Value=true \
    --message-action SUPPRESS \
    --region "$AWS_REGION" 2>/dev/null

  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ User \"${USERNAME}\" created successfully."
  elif [ $EXIT_CODE -eq 254 ]; then # UsernameExistsException returns 254
    echo "🟡 User \"${USERNAME}\" already exists. Skipping creation."
  else
    echo "❌ Error creating user \"${USERNAME}\" (Exit code: $EXIT_CODE)."
    # Rerun without redirecting stderr to show the actual error
    aws cognito-idp admin-create-user \
      --user-pool-id "$USER_POOL_ID" \
      --username "$USER_EMAIL" \
      --temporary-password "$TEMPORARY_PASSWORD" \
      --user-attributes Name=email,Value="$USER_EMAIL" Name=email_verified,Value=true \
      --message-action SUPPRESS \
      --region "$AWS_REGION"
    exit 1
  fi

  # 2.2. Add user to group
  echo "Adding user \"${USERNAME}\" to group \"${GROUP}\"..."
  aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$USER_POOL_ID" \
    --username "$USER_EMAIL" \
    --group-name "$GROUP" \
    --region "$AWS_REGION"

  if [ $? -eq 0 ]; then
    echo "✅ User \"${USERNAME}\" added to group \"${GROUP}\"."
  else
    echo "❌ Error adding user \"${USERNAME}\" to group \"${GROUP}\"."
    exit 1
  fi
done

echo -e "\n🎉 All default users processed successfully!" 