import * as cdk from '@aws-cdk/core'
import * as ecs from '@aws-cdk/aws-ecs'
import * as iam from '@aws-cdk/aws-iam'
import * as sqs from '@aws-cdk/aws-sqs'
import * as lambda from '@aws-cdk/aws-lambda'
import * as dynamodb from '@aws-cdk/aws-dynamodb'
import * as patterns from '@aws-cdk/aws-ecs-patterns'
import { DynamoEventSource, SqsEventSource } from '@aws-cdk/aws-lambda-event-sources'

export class CdkDemoStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        // Create DynamoDB "words" table
        const table = new dynamodb.Table(this, 'DemoWordTable', {
            partitionKey: {
                name: 'wordId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'word',
                type: dynamodb.AttributeType.STRING
            },
            stream: dynamodb.StreamViewType.NEW_IMAGE,
            removalPolicy: cdk.RemovalPolicy.DESTROY // Deletes data on destroy
        })

        // Create the DynamoDB "groups" table
        const groupTable = new dynamodb.Table(this, 'DemoGroupTable', {
            partitionKey: {
                name: 'groupId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'group',
                type: dynamodb.AttributeType.STRING
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY // Deletes data on destroy
        })

        // Create the SQS queue
        const queue = new sqs.Queue(this, 'DemoQueue', {
            visibilityTimeout: cdk.Duration.seconds(300)
        })

        // Create insert word lambda handler
        const insertHandler = new lambda.Function(this, 'InsertWordHandler', {
            runtime: lambda.Runtime.NODEJS_12_X,
            code: lambda.Code.fromAsset('resources/worker'),
            handler: 'index.insertWord',
            environment: {
                TABLE_NAME: table.tableName
            },
            events: [
                new SqsEventSource(queue)
            ]
        })

        // Give the insert handler function permissions to put item into words table
        table.grant(insertHandler, 'dynamodb:PutItem')
        
        // Create a lambda function to handle the DynamoDB words stream
        const streamHandler = new lambda.Function(this, 'StreamHandler', {
            runtime: lambda.Runtime.NODEJS_12_X,
            code: lambda.Code.fromAsset('resources/worker'),
            handler: 'index.groupWords',
            environment: {
                TABLE_NAME: groupTable.tableName
            }
        })

        // Grant the stream handler permissions to put items in the groups table
        groupTable.grant(streamHandler, 'dynamodb:PutItem')

        // Add event stream
        streamHandler.addEventSource(new DynamoEventSource(table, {
            startingPosition: lambda.StartingPosition.LATEST,
            batchSize: 5,
            maxBatchingWindow: cdk.Duration.seconds(30),
            bisectBatchOnError: false,
            // onFailure: new SqsDlq(deadLetterQueue),
            retryAttempts: 1
        }));

        // Create app infrastructure
        const appService = new patterns.ApplicationLoadBalancedFargateService(this, 'DemoAppService', {
            memoryLimitMiB: 512,
            taskImageOptions: {
                image: ecs.ContainerImage.fromAsset('resources/app'),
                containerPort: 8000,
                environment: {
                    'QUEUE_URL': queue.queueUrl
                },
            },
            desiredCount: 1,
        })

        // Create a new policy
        const policy = new iam.Policy(this, 'DemoAppPolicy')

        // Add a statement for SQS
        policy.addStatements(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: [queue.queueArn],
            actions: ['sqs:SendMessage']
        }))

        appService.taskDefinition.taskRole.attachInlinePolicy(policy)

        appService.targetGroup.configureHealthCheck({
            path: '/health'
        })
    }
}
