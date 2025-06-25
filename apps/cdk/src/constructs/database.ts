import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DatabaseTableProps {
  environment: string;
  appName: string;
  tableName: string;
  partitionKey: {
    name: string;
    type: dynamodb.AttributeType;
  };
  sortKey?: {
    name: string;
    type: dynamodb.AttributeType;
  };
  timeToLiveAttribute?: string;
}

export class DatabaseTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseTableProps) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'Table', {
      tableName: props.tableName,
      partitionKey: props.partitionKey,
      sortKey: props.sortKey,
      timeToLiveAttribute: props.timeToLiveAttribute,
      removalPolicy:
        props.environment === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
  }
}
