export default function(mongoClient) {
    function addSubscription(chatId, link, name) {
        return new Promise((resolve, reject) => {
            mongoClient.connect(async (error, mongo) => {
                if (error) {
                    reject(error)
                }
                let collection  = mongo.db(process.env.MONGO_DB).collection('subscriptions')
                await collection.insertOne({
                        chat_id:    chatId,
                        link:       link,
                        name:       name,
                        checkdate:  new Date().toISOString()
                    })
                resolve()
            })
        })
    }
    
    function deleteSubscription(chatId, subscriptionName) {
        return new Promise((resolve, reject) => {
            mongoClient.connect(async (error, mongo) => {
                if (error) {
                    reject(error)
                }
                let collection = mongo.db(process.env.MONGO_DB).collection('subscriptions')
                await collection.deleteOne({
                    $and: [
                        { chat_id:  chatId },
                        { name:     subscriptionName  }
                    ]
                })
                resolve()
            })  
        })
    }
    
    function findSubscriptionsByField(chatId, field, value) {
        return new Promise((resolve, reject) => {
            mongoClient.connect(async (error, mongo) => {
                if (error) {
                    reject(error)
                }
                let collection      = mongo.db(process.env.MONGO_DB).collection('subscriptions')
                let subscriptions   = await collection.find({
                    $and: [
                        { chat_id: chatId },
                        { [field]: value }
                ]}).toArray()
                resolve(subscriptions)
            })
        })
    }
    
    function findAllSubscriptions(chatId) {
        return new Promise((resolve, reject) => {
            mongoClient.connect(async (error, mongo) => {
                if (error) {
                    reject(error)
                }
                let collection      = mongo.db(process.env.MONGO_DB).collection('subscriptions')
                let subscriptions   = await collection.find({chat_id: chatId}).toArray()
                resolve(subscriptions)
            })
        })
    }

    return { addSubscription, deleteSubscription, findSubscriptionsByField, findAllSubscriptions }
}