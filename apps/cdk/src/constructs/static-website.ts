import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface StaticWebsiteProps {
  environment: string;
  appName: string;
  webAssetPath?: string;
}

export class StaticWebsite extends Construct {
  public readonly cloudFrontDomain: string;
  public readonly websiteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StaticWebsiteProps) {
    super(scope, id);

    // S3 Bucket
    const bucketName = `${props.appName}-web-${props.environment}`
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-');
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      removalPolicy:
        props.environment === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environment !== 'prod',
    });

    // CloudFront OAI
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI');

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessIdentity(
          this.websiteBucket,
          { originAccessIdentity: oai }
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
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    this.cloudFrontDomain = this.distribution.distributionDomainName;

    // Deploy assets
    const sources = [];
    if (props.webAssetPath) {
      sources.push(s3deploy.Source.asset(props.webAssetPath));
    }
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources,
      destinationBucket: this.websiteBucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });
    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });
  }
}
