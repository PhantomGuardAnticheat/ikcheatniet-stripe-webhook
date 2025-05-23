import { BaseChannel, Client, EmbedBuilder, TextChannel } from "discord.js";

class DiscordClient {
    private static instance: DiscordClient | null = null;
    private client: Client;
    private token: string;

    private constructor(token: string) {
        this.token = token;
        this.client = new Client({
            intents: 3276799,
        });

        this.client.once("ready", () => {
            console.log(`Discord client is ready! Logged in as ${this.client.user?.username}`);
        });

        this.client.login(this.token).catch((err) => {
            console.error("Error logging in to Discord:", err);
        });
    }

    public static getInstance(token: string): DiscordClient {
        if (!DiscordClient.instance) {
            DiscordClient.instance = new DiscordClient(token);
        }
        return DiscordClient.instance;
    }

    public setRole(discordId: string, roleId: string, addRole: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error("Discord client not initialized"));
                return;
            }

            const guild = this.client.guilds.cache.get(process.env.DISCORD_GUILD_ID!) || this.client.guilds.cache.first();
            if (!guild) {
                reject(new Error("No guild found"));
                return;
            }

            const member = guild.members.cache.get(discordId);
            if (!member) {
                reject(new Error("No member found"));
                return;
            }

            const role = guild.roles.cache.get(roleId);
            if (!role) {
                reject(new Error("No role found"));
                return;
            }

            if (addRole) {
                member.roles.add(role).then(() => {
                    console.log(`Added role ${role.name} to user ${member.user.username}`);
                }).catch((err) => {
                    console.error(`Error adding role: ${err}`);
                    reject(err);
                });
            } else {
                member.roles.remove(role).then(() => {
                    console.log(`Removed role ${role.name} from user ${member.user.username}`);
                }).catch((err) => {
                    console.error(`Error removing role: ${err}`);
                    reject(err);
                });
            }

            resolve();
        });
    }

    public sendLog(discordId: string, log: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error("Discord client not initialized"));
                return;
            }

            const guild = this.client.guilds.cache.get(process.env.DISCORD_GUILD_ID!) || this.client.guilds.cache.first();

            if (!guild) {
                reject(new Error("No guild found"));
                return;
            }

            const member = guild.members.cache.get(discordId);
            if (!member) {
                reject(new Error("No member found"));
                return;
            }

            const channel = guild.channels.cache.get(process.env.DISCORD_LOGS_CHANNEL!);

            if (!channel) {
                reject(new Error("No channel found"));
                return;
            }

            if (!channel.isTextBased()) {
                reject(new Error("Channel type is not text"));
                return;
            }

            let HiddenKey;

            if (log.key) {
                HiddenKey = log.key.split("-")[0] + "-<hidden>-" + log.key.split("-")[2];
            }

            const embed = new EmbedBuilder()
                .setTitle("💰 Payment Received")
                .setDescription(`A payment was made by <@${member.user.id}> (${member.user.username})`)
                .setColor(0x00FF99)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    {
                        name: "Amount",
                        value: `\`${log.amount_received}\` _(~~${log.amount}~~)_ ${log.currency.toUpperCase()}`,
                        inline: true,
                    },
                    {
                        name: "Status",
                        value: `\`${log.paymentStatus}\``,
                        inline: true,
                    },
                    ...(log.created
                        ? [{
                            name: "Date",
                            value: `<t:${Math.floor(log.created / 1000)}:F>`,
                            inline: true,
                        }]
                        : []),
                    ...(HiddenKey
                        ? [{
                            name: "License Key",
                            value: `\`${HiddenKey}\``,
                            inline: true,
                        }]
                        : []),
                )
                .setFooter({ text: `User ID: ${member.user.id}` })
                .setTimestamp(new Date());

            (channel as TextChannel).send({ embeds: [embed] })
                .then(() => {
                    console.log(`Sent payment log to channel ${channel.name}`);
                    resolve();
                })
                .catch((err: any) => {
                    console.error(`Error sending log: ${err}`);
                    reject(err);
                });
        });
    }

    public static destoryClient(): void {
        if (DiscordClient.instance) {
            DiscordClient.instance.client.destroy();

            DiscordClient.instance = null;
        }
    }
}

export default DiscordClient;