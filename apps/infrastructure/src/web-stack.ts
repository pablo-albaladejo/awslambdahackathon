import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as rum from 'aws-cdk-lib/aws-rum';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

interface WebStackProps extends cdk.StackProps {
  environment: string;
  webAssetPath?: string;
  identityPoolId: string;
}

export class WebStack extends cdk.Stack {
  public readonly cloudFrontDomain: string;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    // Frontend hosting: S3 Bucket
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `awslambdahackathon-web-${props.environment}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // For SPA routing
      publicReadAccess: false, // CloudFront will access it
      removalPolicy:
        props.environment === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'prod',
    });

    // CloudFront Origin Access Identity
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI');

    // CloudFront Distribution for the website
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessIdentity(
          websiteBucket,
          {
            originAccessIdentity: oai,
          }
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // RUM App Monitor
    const appMonitor = new rum.CfnAppMonitor(this, 'RumAppMonitor', {
      domain: distribution.distributionDomainName,
      name: `awslambdahackathon-web-${props.environment}`,
      appMonitorConfiguration: {
        allowCookies: true,
        enableXRay: true,
        identityPoolId: props.identityPoolId,
        sessionSampleRate: 1,
        telemetries: ['performance', 'errors', 'http'],
      },
    });

    // Store CloudFront domain for use in other stacks
    this.cloudFrontDomain = distribution.distributionDomainName;

    // Deploy website files to S3 (only if webAssetPath is provided)
    const rumConfig = {
      identityPoolId: props.identityPoolId,
      applicationId: appMonitor.attrId,
      region: this.region,
    };

    const sources = [
      s3deploy.Source.data('rum-config.json', JSON.stringify(rumConfig)),
    ];

    if (props.webAssetPath) {
      sources.push(s3deploy.Source.asset(props.webAssetPath));
    }

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources,
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });
  }
}
