import * as cdk from '@aws-cdk/core'
import * as CdkDemo from '../lib/cdk-demo-stack'
import { expect, haveResource } from '@aws-cdk/assert'

test('creates queue', () => {
    const app = new cdk.App()
    const stack = new CdkDemo.CdkDemoStack(app, 'TestStack')
    expect(stack).to(haveResource(
        'AWS::SQS::Queue', {
            'VisibilityTimeout': 300
        }
    ))
})