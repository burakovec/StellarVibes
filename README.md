# Stellar Vibes 🚀✨

Stellar Vibes is a decentralized messaging application built on the Stellar network. It allows users to send expressive "Vibes" (emojis with labels) and short notes to other Stellar accounts.

## Features

- **Connect with Freighter**: Securely connect your Stellar wallet using the Freighter extension.
- **Send Vibes**: Choose from a curated list of vibes like Rocket 🚀, Trust 💙, Lit 🔥, Magic ✨, and more.
- **Add Notes**: Attach a short, optional note (up to 20 characters) to your vibe.
- **Visual History**: View your sent and received vibes in a beautiful, card-based interface.
- **Fund Friendbot**: Easily fund testnet accounts directly from the UI if a recipient doesn't exist.
- **Real-time Updates**: Refresh your vibe history to see new messages instantly.

## Tech Stack

- **Frontend**: Next.js 15+ (App Router), React
- **Styling**: Tailwind CSS
- **Stellar Integration**: 
  - `@stellar/freighter-api` for wallet connection and signing.
  - `stellar-sdk` for building transactions and querying the Horizon API.
- **Icons**: Lucide React

## Getting Started

1. **Install Freighter**: Make sure you have the [Freighter Wallet](https://www.freighter.app/) extension installed in your browser.
2. **Connect Wallet**: Click "Connect Freighter" in the app.
3. **Select Network**: Ensure your wallet is connected to the Stellar Testnet for testing.
4. **Send a Vibe**: Enter a recipient's public key (starting with `G...`), select a vibe, add a note, and hit send!

## How it Works

Messages are sent as **Stellar Payment Operations** with a minimum amount (0.0000001 XLM). The actual message content (the vibe ID and note) is stored in the transaction **Memo** field.

The app parses these memos to display the rich UI you see.

Example Memo Format: `VIBE:rocket:To the moon!`

## License

MIT
