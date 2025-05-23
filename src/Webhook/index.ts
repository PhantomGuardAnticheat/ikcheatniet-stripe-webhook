import { IncomingMessage } from "http";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "")


export default class WebhookClient {
    public static verifyWebhookSignature(req: IncomingMessage, body: Buffer, signature: string | undefined) {
        if (!signature) {
            console.error("No signature provided");
            return false;
        }

        let event: Stripe.Event | null = null;

        try {
            event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET || "");
        } catch (err) {
            console.error("Error verifying webhook signature:", err);
            return false;
        }

        return event;
    }

    public static async getProducts(
        payment_link: string, // Example payment_link: plink_1RGxxxxxxxxxx
    ): Promise<Stripe.Response<Stripe.Product>> {
        return new Promise(async (resolve, reject) => {
            if (!payment_link) {
                reject(new Error("payment_link not found"));
                return;
            }

            try {
                const paymentLink = await stripe.paymentLinks.retrieve(payment_link);

                const lineItems = await stripe.paymentLinks.listLineItems(payment_link, { limit: 1 });
                const item = lineItems.data[0];

                if (!item || !item.price || !item.price.id) {
                    reject(new Error("No line item found in payment link"));
                    return;
                }

                const price = await stripe.prices.retrieve(item.price.id);
                const product = await stripe.products.retrieve(price.product as string);

                resolve(product)
            } catch (err) {
                reject(err);
            }
        });
    };
}