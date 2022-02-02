import TelegramBot  from 'node-telegram-bot-api'
import Parser       from 'rss-parser'
import Mongo        from './mongo.js'
import dotenv       from 'dotenv'

dotenv.config()

const bot           = new TelegramBot(process.env.BOT_TOKEN, {polling: true})
const parser        = new Parser()
const mongo         = Mongo()

bot.onText(/\/start/, (msg) => {
    bot.clearReplyListeners()
    const chatId = msg.chat.id
    bot.sendMessage(chatId, 'Привет!\nДобавить RSS-ленту для рассылки /add\nСписок доступных команд /help')
})

bot.onText(/\/help/, (msg) => {
    bot.clearReplyListeners()
    const chatId = msg.chat.id
    bot.sendMessage(chatId, 'Доступные команды:\nДобавить RSS-ленту для рассылки /add\nУдалить RSS-ленту /delete')
})

bot.onText(/\/add/, async (msg) => {
    bot.clearReplyListeners()
    const chatId        = msg.chat.id
    let sendedMessage   = await bot.sendMessage(chatId, 'Укажите ссылку на RSS-ленту', {reply_markup: {force_reply: true}})
    bot.onReplyToMessage(chatId, sendedMessage.message_id, async (msg) => {
        try {
            const rss = msg.text
            try {
                await parser.parseURL(rss)
            } catch (error) {
                if (error.code === 'ERR_UNESCAPED_CHARACTERS') return bot.sendMessage(chatId, 'Некорректная ссылка на RSS-ленту') 
                throw error
            }
            let subscriptions = await mongo.findSubscriptionsByField(chatId, 'rss', rss)
            if (subscriptions.length) return bot.sendMessage(chatId, 'Вы уже подписаны на эту RSS-ленту')
            sendedMessage = await bot.sendMessage(chatId, 'Укажите название для RSS-ленты', {reply_markup: {force_reply:true}}) 
            bot.onReplyToMessage(chatId, sendedMessage.message_id, async (msg) => {
                try {
                    const name = msg.text

                    let subscriptions = await mongo.findSubscriptionsByField(chatId, 'name', name)
                    if (subscriptions.length) return bot.sendMessage(chatId, 'У Вас уже есть подписка с таким названием')
                    await mongo.addSubscription(chatId, rss, name)
                    bot.sendMessage(chatId, 'RSS-лента добавлена')
                } catch (error) {
                    console.error(error)
                    bot.sendMessage(chatId, 'Не удалось добавить RSS-ленту')
                }
            })
        } catch (error) {
            console.error(error)
            bot.sendMessage(chatId, 'Не удалось добавить RSS-ленту')
        }
    })
})

bot.onText(/\/delete/, async (msg) => {
    bot.clearReplyListeners()
    const chatId = msg.chat.id
    try {
        let subscriptions = await mongo.findSubscriptionsByChatId(chatId)
        if (!subscriptions.length) return bot.sendMessage(chatId, 'У Вас нет подписок')
        let keyboard = []
        for (let subscription of subscriptions) {
            let inlineKey   = []
            let key         = {
                text:           subscription.name,
                callback_data:  subscription._id
            }
            inlineKey.push(key)
            keyboard.push(inlineKey)
        }          
        bot.sendMessage(chatId, 'Выберите RSS-ленту для удаления', {reply_markup: {inline_keyboard: keyboard}}) 
    } catch (error) {
        console.error(error)
        bot.sendMessage(chatId, 'Произошла ошибка')
    }
})

bot.on('callback_query', async (callbackQuery) => {
    if (callbackQuery.message.text == 'Выберите RSS-ленту для удаления') {
        try {
            await mongo.deleteSubscription(callbackQuery.data)
            bot.sendMessage(callbackQuery.message.chat.id, 'RSS-лента удалена')
        } catch (error) {
            bot.sendMessage(callbackQuery.message.chat.id, 'Не удалось удалить RSS-ленту')
            console.log(error)
        }
    }
})

setInterval(async () => {
    try {
        let subscriptions = await mongo.findAllSubscriptions()
        for (let subscription of subscriptions) {
            let dist    = []
            let feed    = await parser.parseURL(subscription.rss)
            feed.items.reverse().forEach(async (item) => {
                try {
                    if (item.isoDate > subscription.checkdate && !subscription.checktitles.includes(item.title) && !subscription.checklinks.includes(item.link)) {
                        dist.push(item)
                        await mongo.updateSubscription(subscription._id, item)
                    }
                } catch (error) {
                    console.error(error)
                }
            })
            for (let job of dist) {
                bot.sendMessage(subscription.chat_id, job.title.replace('Upwork', '') + job.link)
            }
        }
    } catch (error) {
        console.error(error)
    }
}, 1000*60)