import TelegramBot      from 'node-telegram-bot-api'
import Parser           from 'rss-parser'
import mongodb          from 'mongodb'
import subscriptions    from './subscriptions.js'
import dotenv           from 'dotenv'

dotenv.config()

const mongoClient   = new mongodb.MongoClient(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true})
const bot           = new TelegramBot(process.env.BOT_TOKEN, {polling: true})
const parser        = new Parser()
const subscription  = subscriptions(mongoClient)

setInterval(() => {
    try {
        mongoClient.connect(async (error, mongo) => {
            if (error) {
                throw error
            }
            let collection      = mongo.db(process.env.MONGO_DB).collection('subscriptions')
            let subscriptions   = await collection.find().toArray()
            for (let subscription of subscriptions) {
                let viewFeed    = []
                let feed        = await parser.parseURL(subscription.link)
                feed.items.reverse().forEach(async (item) => {
                    if (item.isoDate > subscription.checkdate) {
                        viewFeed.push(item)
                        await collection.updateOne(
                            {
                                $and: [
                                    {chat_id:   subscription.chat_id},
                                    {name:      subscription.name}
                                ]
                            },
                            {
                                $set: {checkdate: item.isoDate}
                            }
                        )
                        
                    }
                })
                for (let item of viewFeed) {
                    bot.sendMessage(subscription.chat_id, item.title + ' ' + item.link)
                }
            }
        })
    } catch {
        console.error(error)
    }
}, 1000*60)

bot.on('message', async (msg) => {
    try {
        const chatId    = msg.chat.id
        const text      = msg.text

        switch (text) {
            case '/start':
                bot.clearReplyListeners()
                bot.sendMessage(chatId, 'Привет!\nДобавить RSS-ленту для рассылки /add\nСписок доступных команд /help')
                break

            case '/help':
                bot.clearReplyListeners()
                bot.sendMessage(chatId, 'Доступные команды:\nДобавить RSS-ленту для рассылки /add\nУдалить RSS-ленту /delete')
                break

            case '/add':
                bot.clearReplyListeners()
                let sendedMessage = await bot.sendMessage(chatId, 'Укажите ссылку на RSS-ленту', {reply_markup: {force_reply: true}})
                bot.onReplyToMessage(chatId, sendedMessage.message_id, async (msg) => {
                    try {
                        const link = msg.text
                        await parser.parseURL(link)
                        let subscriptions = await subscription.findSubscriptionsByField(chatId, 'link', link)
                        if (subscriptions.length !== 0) {
                            return bot.sendMessage(chatId, 'Вы уже подписаны на эту RSS-ленту')
                        }
                        sendedMessage = await bot.sendMessage(chatId, 'Укажите название для RSS-ленты', {reply_markup: {force_reply:true}}) 
                        bot.onReplyToMessage(chatId, sendedMessage.message_id, async (msg) => {
                            const name = msg.text
                            let subscriptions = await subscription.findSubscriptionsByField(chatId, 'name', name)
                            if (subscriptions.length !== 0) {
                                return bot.sendMessage(chatId, 'У Вас уже есть подписка с таким названием')
                            }
                            await subscription.addSubscription(chatId, link, name)
                            bot.sendMessage(chatId, 'RSS-лента добавлена')
                        })   
                    } catch (error) {
                        bot.sendMessage(chatId, 'Не удалось добавить RSS-ленту')
                        throw error
                    }
                })
                break

            case '/delete':
                bot.clearReplyListeners()
                try {
                    (async () => {
                        let subscriptions = await subscription.findAllSubscriptions(chatId)
                        if (subscriptions.length == 0) {
                            return bot.sendMessage(chatId, 'У Вас нет подписок')
                        }
                        let keyboard        = []
                        for (let subscription of subscriptions) {
                            let inlineKey   = []
                            let key         = {
                                text:           subscription.name,
                                callback_data:  subscription.name
                            }
                            inlineKey.push(key)
                            keyboard.push(inlineKey)
                        }
                        bot.sendMessage(chatId, 'Выберите RSS-ленту для удаления', {reply_markup: {inline_keyboard: keyboard}})    
                    })()
                } catch (error) {
                    bot.sendMessage(chatId, 'Произошла ошибка. /help')
                    throw error
                }
                break
        }
    } catch (error) {
        console.log(error)
    }
})  

bot.on('callback_query', async (callbackQuery) => {
    try {
        if (callbackQuery.message.text == 'Выберите RSS-ленту для удаления') {
            await subscription.deleteSubscription(callbackQuery.message.chat.id, callbackQuery.data)
            bot.sendMessage(callbackQuery.message.chat.id, 'RSS-лента удалена')
        }
    } catch {
        bot.sendMessage(chatId, 'Не удалось удалить RSS-ленту')
        console.log(error)
    }
})