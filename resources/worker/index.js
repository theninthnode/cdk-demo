
const uuid = require('uuid')
const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient()

exports.insertWord = async function (event, context) {
    for (const record of event.Records) {
        const data = JSON.parse(record.body)

        const item = {
            wordId: `${data.word.substring(0, 1)}-${uuid.v4()}`,
            word: data.word,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    
        const params = {
            TableName: process.env.TABLE_NAME,
            Item: item
        }
        
        await dbClient.put(params).promise()
    
        context.succeed()
    }
}

exports.groupWords = async function (event, context) {
    const words = []
    for (const record of event.Records) {
        console.log(JSON.stringify(record.dynamodb))
        words.push(record.dynamodb.NewImage.word.S)         
    }

    const group = words.join('+')

    const item = {
        groupId: `${group.substring(0, 1)}-${uuid.v4()}`,
        group: group,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }

    const params = {
        TableName: process.env.TABLE_NAME,
        Item: item
    }
    
    await dbClient.put(params).promise()

    context.succeed()
}