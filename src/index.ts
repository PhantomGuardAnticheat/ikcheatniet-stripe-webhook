import "dotenv/config";

import { createServer, IncomingMessage, ServerResponse } from "http";
import * as crypto from "crypto";
import Stripe from "stripe";

import WebhookClient from "./Webhook";
import DiscordClient from "./Discord/Client";
let Ikcheatniet = class {
    public static createKey(
        payment_link: string,
    ): Promise<any> {
        return new Promise(async (resolve, reject) => {
            return reject(new Error("Ikcheatniet is not available"));
        });
    }
}

const Discordclient = DiscordClient.getInstance(process.env.DISCORD_TOKEN!);

if (!process.env.IKCHEATNIET_API_KEY) {
    console.error(`
        IKCHEATNIET_API_KEY was not found in .env file. This will mean that the project will not contain the functionality to create Ikcheatniet keys and handle other Ikcheatniet related stuff.

        PLEASE NOTE: This is not a bug, we intentionally do not include the API key as well as the proper utility file to handle the events, are you seeking for support as to making a custom version of the API handler for your own project? Please contact us on our Discord server: https://discord.gg/WB5RUz7RgU
    `);

    (<any>Ikcheatniet) = null;
} else {
    Ikcheatniet = require("./utils/ikcheatniet").default;
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'POST' && req.url === '/webhook') {
        let data: Buffer[] = [];
        req.on('data', chunk => data.push(chunk));

        req.on('end', () => {
            const body = Buffer.concat(data);
            const signature = req.headers['stripe-signature'] as string | undefined;
            const stripeEvent = WebhookClient.verifyWebhookSignature(req, body, signature) as Stripe.Event | boolean;

            if (!stripeEvent || typeof stripeEvent === 'boolean') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid signature' }));
                return;
            }

            switch (stripeEvent.type) {
                case "checkout.session.completed":
                    const session = stripeEvent.data.object as Stripe.Checkout.Session;

                    if (!session) {
                        console.error("No session found in event data");
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'No session found' }));
                        return;
                    }

                    const discordId = session.custom_fields?.find((field) => field.key === "discordid")?.text?.value || false;
                    const amount = (session.amount_subtotal || 0) / 100;
                    const amount_received = (session.amount_total || 0) / 100;
                    const currency = session.currency || "eur";
                    const paymentStatus = session.payment_status || "unpaid";
                    const created = session.created || 0;
                    const payment_link = session.payment_link?.toString() || false;

                    if (!discordId) {
                        console.error("No Discord ID found in session metadata");
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'No Discord ID found' }));
                        return;
                    }

                    Discordclient.setRole(discordId, process.env.DISCORD_ROLE_ID! || "", true)
                        .catch((err) => {
                            console.error("Error setting role:", err);

                            if (!res.headersSent) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Error setting role' }));
                            }
                        })
                        .then(() => {
                            console.log(`Role added to user ${discordId}`)
                        });

                    Ikcheatniet.createKey(
                        payment_link || "",
                    )
                        .catch((err) => {
                            console.error("Error creating key:", err);
                            if (!res.headersSent) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Error creating key' }));
                            }
                        })
                        .then((key) => {
                            if (!key) {
                                console.error("No key found");
                                if (!res.headersSent) {
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: 'No key found' }));
                                }
                            }

                            Discordclient.sendLog(discordId, {
                                amount: amount,
                                amount_received: amount_received,
                                currency: currency,
                                paymentStatus: paymentStatus,
                                created: created,
                                key: key,
                            })
                                .catch((err) => {
                                    console.error("Error sending log:", err);

                                    if (!res.headersSent) {
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ error: 'Error sending log' }));
                                    }
                                })
                                .then(() => {
                                    console.log(`Log sent to channel for user ${discordId}`);

                                    if (!res.headersSent) {
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ received: true }));
                                    }
                                })
                        });
                    break;
                default:
                    console.log(`Unhandled event type ${stripeEvent.type}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ received: true }));
                    break;
            }
        });
    } else {
        if (req.url == "/") {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hello World');
        }
    }
})

server.listen(4783, () => {
    console.log('Server is running on port 4783');
});

// Error handling \\
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');

    DiscordClient.destoryClient();

    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});