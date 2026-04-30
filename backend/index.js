import {
    Telegraf
} from 'telegraf';
import dotenv from 'dotenv';
import {
    supabase
} from './supabase.js';
import {
    parseMessage
} from './parser.js';
import {
    applyRules
} from './ruleEngine.js';

import { pushToGoogleSheets } from './services/googleSheets.js'

import express from 'express';

const app = express();

// health check route
app.get('/', (req, res) => {
  res.send('Bot is running');
});

// IMPORTANT: Railway requires a port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

console.log('Bot running...');

/* =========================
   HELPER FUNCTIONS
========================= */

// Get user
async function getUser(telegramId) {
    const {
        data,
        error
    } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

    if (error || !data) return null;
    return data;
}

// Get ledger
async function getLedgerId(userId) {
    const {
        data
    } = await supabase
        .from('ledger_members')
        .select('ledger_id')
        .eq('user_id', userId)
        .limit(1);

    return data?.[0]?.ledger_id || null;
}

// Get default account
async function getDefaultAccount(ledgerId) {
    const {
        data
    } = await supabase
        .from('accounts')
        .select('*')
        .eq('ledger_id', ledgerId)
        .eq('is_default', true)
        .single();

    return data;
}

// Get Uncategorized category
async function getUncategorized(ledgerId) {
    const {
        data
    } = await supabase
        .from('categories')
        .select('*')
        .eq('ledger_id', ledgerId)
        .ilike('name', 'uncategorized')
        .single();

    return data;
}

function extractRuleKeyword(merchant = '') {
    const stopWords = new Set([
        'the', 'for', 'and', 'to', 'from', 'on', 'at', 'via', 'using', 'paid', 'pay', 'spent', 'spend'
    ]);
    const accountWords = new Set([
        'upi', 'gpay', 'phonepe', 'paytm', 'hdfc', 'icici', 'axis', 'sbi', 'amex', 'card', 'cc'
    ]);

    const tokens = merchant
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length > 2 && !stopWords.has(token) && !accountWords.has(token));

    if (tokens.length >= 2) {
        return `${tokens[0]} ${tokens[1]}`;
    }

    return tokens[0] || null;
}

/* =========================
   COMMAND: UNDO
========================= */

bot.hears(/^undo$/i, async (ctx) => {
    try {
        const telegramId = ctx.from.id.toString();

        const user = await getUser(telegramId);
        if (!user) return ctx.reply("User not found");

        const ledgerId = await getLedgerId(user.id);
        if (!ledgerId) return ctx.reply("User not linked to ledger");

        const {
            data: txList
        } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .eq('ledger_id', ledgerId)
            .order('created_at', {
                ascending: false
            })
            .limit(1);

        const tx = txList?.[0];
        if (!tx) return ctx.reply("No transactions to undo");

        await supabase
            .from('transactions')
            .delete()
            .eq('id', tx.id);

        ctx.reply(`Deleted ₹${tx.amount} (${tx.category || 'Uncategorized'})`);

    } catch (err) {
        console.error(err);
        ctx.reply("Error in undo");
    }
});

/* =========================
   COMMAND: EDIT LAST
========================= */

bot.hears(/^edit last (.+)/i, async (ctx) => {
    try {
        const telegramId = ctx.from.id.toString();
        const newCategoryName = ctx.match[1].toLowerCase();

        const user = await getUser(telegramId);
        if (!user) return ctx.reply("User not found");

        const ledgerId = await getLedgerId(user.id);
        if (!ledgerId) return ctx.reply("User not linked to ledger");

        // Get category
        const {
            data: category
        } = await supabase
            .from('categories')
            .select('*')
            .eq('ledger_id', ledgerId)
            .ilike('name', newCategoryName)
            .single();

        if (!category) return ctx.reply("Category not found");

        // Get last transaction
        const {
            data: txList
        } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .eq('ledger_id', ledgerId)
            .order('created_at', {
                ascending: false
            })
            .limit(1);

        const tx = txList?.[0];
        if (!tx) return ctx.reply("No transactions found");

        // Update transaction
        await supabase
            .from('transactions')
            .update({
                category_id: category.id,
                category: category.name
            })
            .eq('id', tx.id);

        // 🔥 Rule learning (UPSERT)
        const keyword = extractRuleKeyword(tx.merchant || tx.notes || '');

        if (keyword) {
            await supabase
                .from('rules')
                .upsert({
                    ledger_id: ledgerId,
                    keyword,
                    category_id: category.id,
                    priority: 1
                }, {
                    onConflict: 'ledger_id,keyword'
                });
        }

        ctx.reply(`Updated to ${category.name} & learned rule`);

    } catch (err) {
        console.error(err);
        ctx.reply("Error updating transaction");
    }
});

/* =========================
   MAIN HANDLER
========================= */

bot.on('text', async (ctx) => {
    try {
        const telegramId = ctx.from.id.toString();
        const text = ctx.message.text;

        // ❗ Skip command texts (extra safety)
        if (
            text.toLowerCase() === 'undo' ||
            text.toLowerCase().startsWith('edit last')
        ) return;

        // 1. Get user
        const user = await getUser(telegramId);
        if (!user) return ctx.reply("User not found");

        // 2. Get ledger
        const ledgerId = await getLedgerId(user.id);
        if (!ledgerId) return ctx.reply("User not linked to ledger");

        // 3. Parse message
        let parsed = parseMessage(text);

        // ❗ Validation
        if (!parsed.amount) {
            return ctx.reply("Couldn't detect amount. Try: 500 swiggy");
        }

        // 4. Apply rules
        parsed = await applyRules(parsed, ledgerId, user.id);

        // 🔍 DEBUG
        console.log("After rules:", parsed);
        console.log("Account match source:", parsed.account_match_source || 'fallback/default');

        // 5. Default account fallback
        if (!parsed.account_id) {
            const defaultAccount = await getDefaultAccount(ledgerId);
            parsed.account_id = defaultAccount?.id;
        }

        // 6. Default category fallback
        if (!parsed.category_id) {
            const uncategorized = await getUncategorized(ledgerId);
            parsed.category_id = uncategorized?.id;
            parsed.category_name = uncategorized?.name || 'Uncategorized';
        }

        // 7. Insert transaction

        const IST = 'Asia/Kolkata';

        // inside your handler
        const nowIST = dayjs().tz(IST);
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            ledger_id: ledgerId,
            user_id: user.id,
            amount: parsed.amount,
            type: parsed.type,
            category_id: parsed.category_id,
            category: parsed.category_name,
            account_id: parsed.account_id,

            payment_method: parsed.payment_method || '',
            flow_category: parsed.flow_category || '',

            merchant: parsed.merchant || text,
            notes: text,
            raw_input: text,
            source: 'bot',

            date: nowIST.format('YYYY-MM-DD'),
            created_at: nowIST.toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('DB insert failed', error);
          return;
        }

        try {
          console.log('About to push to Google Sheets:', data);
          await pushToGoogleSheets(data);
        } catch (err) {
          console.error('Google Sheets push failed');
          console.error('Message:', err.message);
          console.error('Full error:', err);
          console.error('API response:', err.response?.data);
        }

        // 8. Reply
        ctx.reply(`₹${parsed.amount} → ${parsed.category_name}`);

    } catch (err) {
        console.error(err);
        ctx.reply('Error processing transaction');
    }

});

bot.launch();
console.log("Bot started...");