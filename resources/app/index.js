'use strict';

const Hapi = require('@hapi/hapi')
const AWS = require('aws-sdk')

AWS.config.update({region: 'eu-west-1'})

const sqs = new AWS.SQS({apiVersion: '2012-11-05'})

const init = async () => {
    const server = Hapi.server({
        port: 8000,
        host: '0.0.0.0'
    })

    server.route({
        method: 'GET',
        path: '/health',
        handler: (request, h) => {
            return 'OK'
        }
    })
    
    server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {

            return `
                <html>
                    <form action="/submit" method="post">
                        <input type="text" placeholder="Enter a word" name="word" autocomplete="off" />
                        <button>Save</button>
                    </form>
                </html>
            `
        }
    })

    server.route({
        method: 'POST',
        path: '/submit',
        handler: async (request, h) => {
            const word = request.payload.word

            const params = {
                MessageBody: JSON.stringify({ word }),
                QueueUrl: process.env['QUEUE_URL']
             }
             
            await sqs.sendMessage(params).promise()
               
            return h.redirect('/')
        }
    })

    await server.start()
    console.log('Server running on %s', server.info.uri)
}

process.on('unhandledRejection', (err) => {
    console.log(err)
    process.exit(1)
})

init()