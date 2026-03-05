"use client";

import { useState, useEffect } from "react";
import { isConnected, isAllowed, setAllowed, getAddress, signTransaction, getNetworkDetails } from "@stellar/freighter-api";
import * as StellarSdk from "stellar-sdk";
import { Send, Wallet, RefreshCw, MessageSquare, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";

type Vibe = {
  id: string;
  emoji: string;
  label: string;
  color: string;
};

const VIBES: Vibe[] = [
  { id: 'rocket', emoji: '🚀', label: 'Moon', color: 'bg-blue-100 text-blue-600' },
  { id: 'heart', emoji: '💙', label: 'Trust', color: 'bg-indigo-100 text-indigo-600' },
  { id: 'fire', emoji: '🔥', label: 'Lit', color: 'bg-orange-100 text-orange-600' },
  { id: 'sparkles', emoji: '✨', label: 'Magic', color: 'bg-yellow-100 text-yellow-600' },
  { id: 'coffee', emoji: '☕', label: 'Energy', color: 'bg-amber-100 text-amber-800' },
  { id: 'party', emoji: '🎉', label: 'Hype', color: 'bg-pink-100 text-pink-600' },
  { id: 'money', emoji: '💸', label: 'Paid', color: 'bg-green-100 text-green-600' },
  { id: 'eyes', emoji: '👀', label: 'Look', color: 'bg-gray-100 text-gray-600' },
];

export default function Messenger() {
  const [publicKey, setPublicKey] = useState<string>("");
  const [network, setNetwork] = useState<string>("");
  const [networkUrl, setNetworkUrl] = useState<string>("");
  const [networkPassphrase, setNetworkPassphrase] = useState<string>("");
  
  const [recipient, setRecipient] = useState<string>("");
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [message, setMessage] = useState<string>(""); // Optional note
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [fetching, setFetching] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const connectWallet = async () => {
    setError("");
    try {
      // Check for Freighter
      const connected = await isConnected();
      if (!connected.isConnected) {
        setError("Freighter wallet not detected. If it is installed, please try opening this app in a new tab, as browser extensions often do not work inside iframes.");
        return;
      }
      
      let allowed = await isAllowed();
      if (!allowed.isAllowed) {
        allowed = await setAllowed();
      }
      
      if (allowed.isAllowed) {
        const addressInfo = await getAddress();
        if (addressInfo.address) {
          setPublicKey(addressInfo.address);
          
          const networkInfo = await getNetworkDetails();
          if (networkInfo.network) {
            setNetwork(networkInfo.network);
            setNetworkUrl(networkInfo.networkUrl);
            setNetworkPassphrase(networkInfo.networkPassphrase);
          }
        } else if (addressInfo.error) {
          setError(addressInfo.error);
        }
      } else if (allowed.error) {
        setError(allowed.error);
      }
    } catch (e: any) {
      console.error(e);
      setError("Failed to connect wallet: " + (e.message || "Unknown error"));
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const fetchMessages = async () => {
    if (!publicKey || !networkUrl) return;
    setFetching(true);
    try {
      const server = new StellarSdk.Horizon.Server(networkUrl);
      const txs = await server.transactions().forAccount(publicKey).order("desc").limit(50).call();
      
      const parsedMessages = txs.records
        .filter(tx => tx.memo_type === "text" && tx.memo)
        .map(tx => {
          const isSender = tx.source_account === publicKey;
          let content = tx.memo;
          let vibe = null;
          let note = "";

          // Parse VIBE format: VIBE:rocket:Optional note
          if (content && content.startsWith("VIBE:")) {
            const parts = content.split(":");
            if (parts.length >= 2) {
              const vibeId = parts[1];
              vibe = VIBES.find(v => v.id === vibeId);
              note = parts.slice(2).join(":"); // Join back any remaining parts as note
            }
          }

          return {
            id: tx.id,
            text: content, // Raw text fallback
            vibe,
            note,
            isSender,
            date: new Date(tx.created_at).toLocaleString(),
            source: tx.source_account
          };
        });
        
      setMessages(parsedMessages);
    } catch (e) {
      console.error("Error fetching messages:", e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (publicKey && networkUrl) {
      fetchMessages();
    }
  }, [publicKey, networkUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const fundRecipient = async () => {
    if (!recipient) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`https://friendbot.stellar.org?addr=${recipient}`);
      const data = await response.json();
      if (response.ok) {
        setSuccess("Recipient account funded successfully! You can now send messages.");
      } else {
        setError("Failed to fund account: " + JSON.stringify(data));
      }
    } catch (e: any) {
      setError("Failed to fund account: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!recipient) {
      setError("Recipient is required.");
      return;
    }

    let memoText = message;
    if (selectedVibe) {
      // Format: VIBE:vibeId:note
      memoText = `VIBE:${selectedVibe.id}:${message}`;
    }

    if (!memoText) {
       setError("Please select a vibe or enter a message.");
       return;
    }

    if (memoText.length > 28) {
      setError(`Message too long (${memoText.length}/28 chars). Try a shorter note.`);
      return;
    }
    
    setLoading(true);
    try {
      const server = new StellarSdk.Horizon.Server(networkUrl);
      const sourceAccount = await server.loadAccount(publicKey);
      
      const fee = await server.fetchBaseFee();
      
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: fee.toString(),
        networkPassphrase: networkPassphrase,
      })
        .addOperation(StellarSdk.Operation.payment({
          destination: recipient,
          asset: StellarSdk.Asset.native(),
          amount: "0.0000001", // Minimum amount
        }))
        .addMemo(StellarSdk.Memo.text(memoText))
        .setTimeout(180)
        .build();
        
      const signedTx = await signTransaction(transaction.toXDR(), {
        networkPassphrase: networkPassphrase,
      });
      
      if (signedTx.error) {
        throw new Error(signedTx.error);
      }
      
      const txToSubmit = StellarSdk.TransactionBuilder.fromXDR(signedTx.signedTxXdr, networkPassphrase);
      await server.submitTransaction(txToSubmit);
      
      setMessage("");
      setSelectedVibe(null);
      setSuccess("Vibe sent successfully!");
      fetchMessages();
    } catch (e: any) {
      console.error(e);
      let errorMessage = e.message || "Unknown error";
      let isNoDestination = false;

      if (e.response && e.response.data) {
        console.error("Horizon error details:", e.response.data);
        if (e.response.data.extras && e.response.data.extras.result_codes) {
          const codes = e.response.data.extras.result_codes;
          errorMessage += ` (Result: ${codes.transaction}, Op: ${codes.operations ? codes.operations.join(', ') : 'N/A'})`;
          
          if (codes.operations && codes.operations.includes('op_no_destination')) {
            isNoDestination = true;
            errorMessage = "The recipient account does not exist on the network.";
          } else if (codes.transaction === 'tx_bad_seq') {
            errorMessage += " - Transaction sequence number is invalid. Please refresh the page and try again.";
          } else if (codes.transaction === 'tx_insufficient_balance') {
             errorMessage += " - Insufficient balance to pay for fee.";
          } else if (codes.transaction === 'tx_too_late') {
             errorMessage += " - The transaction expired before it could be submitted. This can happen if your computer's time is not synchronized or if you took too long to sign the transaction. Please try again.";
          }
        } else if (e.response.data.detail) {
           errorMessage += ` (${e.response.data.detail})`;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const shortenAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-indigo-600" />
            Stellar Vibes
          </h1>
          <p className="text-gray-500 mt-1">Send good vibes on the Stellar network</p>
        </div>
        
        {!publicKey ? (
          <div className="flex gap-2">
            <button
              onClick={openInNewTab}
              className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm font-medium text-sm"
            >
              Open in New Tab
            </button>
            <button
              onClick={connectWallet}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm font-medium"
            >
              <Wallet className="w-5 h-5" />
              Connect Freighter
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{shortenAddress(publicKey)}</div>
              <div className="text-xs text-gray-500 capitalize">{network} Network</div>
            </div>
            <button
              onClick={() => {
                setPublicKey("");
                setMessages([]);
              }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex flex-col gap-3 text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
          {error.includes("recipient account does not exist") && network.toLowerCase().includes("test") && (
             <button 
               onClick={fundRecipient}
               disabled={loading}
               className="self-start ml-8 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-medium transition-colors"
             >
               {loading ? "Funding..." : "Fund Recipient with Friendbot"}
             </button>
          )}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3 text-emerald-700">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {publicKey && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Send a Vibe</h2>
              <form onSubmit={sendMessage} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient Public Key
                  </label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="G..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Choose a Vibe
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {VIBES.map((vibe) => (
                      <button
                        key={vibe.id}
                        type="button"
                        onClick={() => setSelectedVibe(vibe)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                          selectedVibe?.id === vibe.id
                            ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                            : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-2xl mb-1">{vibe.emoji}</span>
                        <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">{vibe.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={selectedVibe ? `Add a note to your ${selectedVibe.label} vibe...` : "Or just send a text message..."}
                      maxLength={20} // Reduced length to fit VIBE prefix
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">
                      {message.length}/20
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Total memo length limit: 28 chars
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !recipient || (!message && !selectedVibe)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send {selectedVibe ? 'Vibe' : 'Message'}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-lg font-semibold text-gray-900">Vibe History</h2>
                <button
                  onClick={fetchMessages}
                  disabled={fetching}
                  className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh messages"
                >
                  <RefreshCw className={`w-5 h-5 ${fetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3">
                    <Sparkles className="w-12 h-12 text-gray-300" />
                    <p>No vibes found yet.</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.isSender ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-xs font-medium text-gray-500">
                          {msg.isSender ? 'You' : shortenAddress(msg.source)}
                        </span>
                        <span className="text-xs text-gray-400">{msg.date}</span>
                      </div>
                      
                      {msg.vibe ? (
                        <div className={`relative group ${msg.isSender ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div className={`
                            p-4 rounded-3xl shadow-sm border-2 flex items-center gap-3
                            ${msg.isSender ? 'rounded-tr-sm bg-white border-indigo-100' : 'rounded-tl-sm bg-white border-gray-100'}
                          `}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-3xl ${msg.vibe.color}`}>
                              {msg.vibe.emoji}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{msg.vibe.label} VIBE</span>
                              {msg.note && <span className="text-gray-800 font-medium">{msg.note}</span>}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`px-4 py-2 rounded-2xl max-w-[80%] break-words shadow-sm ${
                            msg.isSender
                              ? 'bg-indigo-600 text-white rounded-tr-sm'
                              : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
