import mongodb  from 'mongodb'
import dotenv   from 'dotenv'

dotenv.config()

export default function() {
    const mongoClient = new mongodb.MongoClient(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true})

    async function findAllSubscriptions() {
        try {
            await mongoClient.connect()
            let subscriptions   = mongoClient.db(process.env.MONGO_DB).collection('subscriptions')
            let result          = await subscriptions.find().toArray()
            return result
        } catch (error) {
            await Promise.reject(error)
        }
    }

    async function findSubscriptionsByChatId(chatId) {
        try {
            await mongoClient.connect()
            let subscriptions   = mongoClient.db(process.env.MONGO_DB).collection('subscriptions')
            let result          = await subscriptions.find({ chat_id: chatId }).toArray()
            return result
        } catch (error) {
            await Promise.reject(error)
        }
    }

    async function findSubscriptionsByField(chatId, field, value) {
        try {
            await mongoClient.connect()
            let subscriptions   = mongoClient.db(process.env.MONGO_DB).collection('subscriptions')
            let result          = await subscriptions.find({
                $and: [
                    { chat_id: chatId },
                    { [field]: value }
                ]}).toArray()
            return result
        } catch (error) {
            await Promise.reject(error)
        }
    }

    async function addSubscription(chatId, rss, name) {
        try {
            await mongoClient.connect()
            let subscriptions   = mongoClient.db(process.env.MONGO_DB).collection('subscriptions')
            let result          = await subscriptions.insertOne({
                chat_id:        chatId,
                rss:            rss,
                name:           name,
                checkdate:      new Date().toISOString(),
                checktitles:    [],
                checklinks:     []
            })
            return result
        } catch (error) {
            await Promise.reject(error)
        }
    }
    
    async function deleteSubscription(subscriptionId) {
        try {
            await mongoClient.connect()
            let subscriptions = mongoClient.db(process.env.MONGO_DB).collection('subscriptions')
            let result = await subscriptions.deleteOne({_id: new mongodb.ObjectId(subscriptionId)})
            return result
        } catch (error) {
            await Promise.reject(error)
        }
    }

    async function updateSubscription(subscriptionId, item) {
        try {
            await mongoClient.connect()
            let subscriptions   = mongoClient.db(process.env.MONGO_DB).collection('subscriptions')
            let result          = await subscriptions.updateOne(
                {
                    _id: new mongodb.ObjectId(subscriptionId)
                },
                {
                    $set: {checkdate: item.isoDate},
                    $push: {
                        checktitles: {
                            $each: [item.title],
                            $slice: -50
                        },
                        checklinks: {
                            $each: [item.link],
                            $slice: -50
                        }
                    }
                }
            )
            return result
        } catch (error) {
            await Promise.reject(error)
        }
    }

    return { findAllSubscriptions, findSubscriptionsByChatId, findSubscriptionsByField, addSubscription, deleteSubscription, updateSubscription }
}