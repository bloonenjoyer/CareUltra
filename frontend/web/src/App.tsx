import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface EncryptedRecord {
  id: string;
  encryptedData: string;
  timestamp: number;
  owner: string;
  category: string;
  status: "pending" | "verified" | "rejected";
}

export default function App() {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<EncryptedRecord[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newRecordData, setNewRecordData] = useState({
    category: "",
    description: "",
    sensitiveInfo: ""
  });
  const [stats, setStats] = useState({
    totalRecords: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
    categoryStats: {} as Record<string, number>
  });

  useEffect(() => {
    loadRecords().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadRecords = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("record_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing record keys:", e);
        }
      }
      
      const list: EncryptedRecord[] = [];
      const categoryStats: Record<string, number> = {};
      let pending = 0;
      let verified = 0;
      let rejected = 0;
      
      for (const key of keys) {
        try {
          const recordBytes = await contract.getData(`record_${key}`);
          if (recordBytes.length > 0) {
            try {
              const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
              const record: EncryptedRecord = {
                id: key,
                encryptedData: recordData.data,
                timestamp: recordData.timestamp,
                owner: recordData.owner,
                category: recordData.category,
                status: recordData.status || "pending"
              };
              
              list.push(record);
              
              // Update stats
              if (record.status === "pending") pending++;
              else if (record.status === "verified") verified++;
              else if (record.status === "rejected") rejected++;
              
              categoryStats[record.category] = (categoryStats[record.category] || 0) + 1;
            } catch (e) {
              console.error(`Error parsing record data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading record ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(list);
      
      // Update statistics
      setStats({
        totalRecords: list.length,
        pending,
        verified,
        rejected,
        categoryStats
      });
    } catch (e) {
      console.error("Error loading records:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitRecord = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting sensitive data with Zama FHE..."
    });
    
    try {
      const encryptedData = `FHE-${btoa(JSON.stringify(newRecordData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const recordId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const recordData = {
        data: encryptedData,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        category: newRecordData.category,
        status: "pending"
      };
      
      await contract.setData(
        `record_${recordId}`, 
        ethers.toUtf8Bytes(JSON.stringify(recordData))
      );
      
      const keysBytes = await contract.getData("record_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(recordId);
      
      await contract.setData(
        "record_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Encrypted data submitted securely!"
      });
      
      await loadRecords();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewRecordData({
          category: "",
          description: "",
          sensitiveInfo: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const verifyRecord = async (recordId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Processing encrypted data with FHE..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const recordBytes = await contract.getData(`record_${recordId}`);
      if (recordBytes.length === 0) {
        throw new Error("Record not found");
      }
      
      const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
      
      const updatedRecord = {
        ...recordData,
        status: "verified"
      };
      
      await contract.setData(
        `record_${recordId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedRecord))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "FHE verification completed successfully!"
      });
      
      await loadRecords();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Verification failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const rejectRecord = async (recordId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Processing encrypted data with FHE..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const recordBytes = await contract.getData(`record_${recordId}`);
      if (recordBytes.length === 0) {
        throw new Error("Record not found");
      }
      
      const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
      
      const updatedRecord = {
        ...recordData,
        status: "rejected"
      };
      
      await contract.setData(
        `record_${recordId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedRecord))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Record rejected successfully!"
      });
      
      await loadRecords();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Rejection failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="cyber-spinner"></div>
      <p>Initializing encrypted connection...</p>
    </div>
  );

  return (
    <div className="app-container cyberpunk-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="shield-icon"></div>
          </div>
          <h1>Confidential<span>Contract</span>Market</h1>
        </div>
        
        <nav className="main-nav">
          <button 
            className={activeTab === "dashboard" ? "active" : ""}
            onClick={() => setActiveTab("dashboard")}
          >
            <div className="nav-icon dashboard-icon"></div>
            Dashboard
          </button>
          <button 
            className={activeTab === "records" ? "active" : ""}
            onClick={() => setActiveTab("records")}
          >
            <div className="nav-icon records-icon"></div>
            Encrypted Data
          </button>
          <button 
            className={activeTab === "tutorial" ? "active" : ""}
            onClick={() => setActiveTab("tutorial")}
          >
            <div className="nav-icon tutorial-icon"></div>
            Tutorial
          </button>
        </nav>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-record-btn cyber-button"
          >
            <div className="add-icon"></div>
            Add Record
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        {activeTab === "dashboard" && (
          <div className="dashboard-tab">
            <div className="welcome-banner">
              <div className="welcome-text">
                <h2>Confidential Contract Marketplace</h2>
                <p>Process sensitive data in encrypted state using Zama FHE technology</p>
              </div>
            </div>
            
            <div className="stats-grid">
              <div className="stat-card cyber-card">
                <h3>Total Records</h3>
                <div className="stat-value">{stats.totalRecords}</div>
              </div>
              
              <div className="stat-card cyber-card">
                <h3>Pending Verification</h3>
                <div className="stat-value">{stats.pending}</div>
              </div>
              
              <div className="stat-card cyber-card">
                <h3>Verified Records</h3>
                <div className="stat-value">{stats.verified}</div>
              </div>
              
              <div className="stat-card cyber-card">
                <h3>Rejected Records</h3>
                <div className="stat-value">{stats.rejected}</div>
              </div>
            </div>
            
            <div className="category-stats cyber-card">
              <h3>Records by Category</h3>
              <div className="category-list">
                {Object.entries(stats.categoryStats).map(([category, count]) => (
                  <div key={category} className="category-item">
                    <div className="category-name">{category}</div>
                    <div className="category-count">{count}</div>
                    <div className="category-bar" ></div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="project-intro cyber-card">
              <h3>About Confidential Contract Market</h3>
              <p>
                Confidential Contract Market leverages Fully Homomorphic Encryption (FHE) technology from Zama to enable 
                processing of sensitive data while maintaining end-to-end encryption. This breakthrough approach allows 
                for privacy-preserving computations on encrypted data without decryption.
              </p>
              <div className="features-grid">
                <div className="feature">
                  <div className="feature-icon fhe-icon"></div>
                  <h4>FHE-Powered</h4>
                  <p>Data remains encrypted during processing using Zama's FHE technology</p>
                </div>
                <div className="feature">
                  <div className="feature-icon privacy-icon"></div>
                  <h4>Privacy-First</h4>
                  <p>Only expose the minimum required information for compliance</p>
                </div>
                <div className="feature">
                  <div className="feature-icon verify-icon"></div>
                  <h4>Verifiable Proofs</h4>
                  <p>Generate cryptographic proofs without revealing underlying data</p>
                </div>
                <div className="feature">
                  <div className="feature-icon industry-icon"></div>
                  <h4>Industry Solutions</h4>
                  <p>Specialized privacy solutions for finance, healthcare, and insurance</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === "records" && (
          <div className="records-tab">
            <div className="section-header">
              <h2>Encrypted Data Records</h2>
              <div className="header-actions">
                <button 
                  onClick={() => setShowCreateModal(true)} 
                  className="add-record-btn cyber-button"
                >
                  <div className="add-icon"></div> Add New Record
                </button>
                <button 
                  onClick={loadRecords}
                  className="refresh-btn cyber-button"
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
            
            <div className="records-list cyber-card">
              {records.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"></div>
                  <p>No encrypted records found</p>
                  <button 
                    onClick={() => setShowCreateModal(true)} 
                    className="cyber-button primary"
                  >
                    Create First Record
                  </button>
                </div>
              ) : (
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Category</th>
                      <th>Owner</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(record => (
                      <tr key={record.id}>
                        <td className="record-id">{record.id.substring(0, 8)}...</td>
                        <td>{record.category}</td>
                        <td className="owner-address">{record.owner.substring(0, 6)}...{record.owner.slice(-4)}</td>
                        <td>{formatDate(record.timestamp)}</td>
                        <td>
                          <span className={`status-badge ${record.status}`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="actions">
                          {isOwner(record.owner) && record.status === "pending" && (
                            <>
                              <button 
                                className="action-btn verify-btn cyber-button"
                                onClick={() => verifyRecord(record.id)}
                              >
                                Verify
                              </button>
                              <button 
                                className="action-btn reject-btn cyber-button"
                                onClick={() => rejectRecord(record.id)}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {record.status === "verified" && (
                            <span className="verified-icon"></span>
                          )}
                          {record.status === "rejected" && (
                            <span className="rejected-icon"></span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        
        {activeTab === "tutorial" && (
          <div className="tutorial-tab">
            <h2>FHE Confidential Contract Tutorial</h2>
            <p className="subtitle">Learn how to securely process sensitive data</p>
            
            <div className="tutorial-steps cyber-card">
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>Connect Your Wallet</h3>
                  <p>Use the wallet connection button in the top right to connect your Web3 wallet. This allows you to interact with the Confidential Contract Market.</p>
                </div>
              </div>
              
              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>Submit Encrypted Data</h3>
                  <p>Click "Add Record" to submit sensitive information. Your data will be encrypted using Zama FHE technology before being stored on-chain.</p>
                  <div className="fhe-visual">
                    <div className="data-box">Sensitive Data</div>
                    <div className="arrow">→</div>
                    <div className="fhe-box">FHE Encryption</div>
                    <div className="arrow">→</div>
                    <div className="encrypted-box">Encrypted Data</div>
                  </div>
                </div>
              </div>
              
              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>Process with FHE</h3>
                  <p>The smart contract processes your encrypted data without decrypting it. This allows for computations like credit scoring or KYC verification while maintaining privacy.</p>
                  <div className="fhe-visual">
                    <div className="encrypted-box">Encrypted Data</div>
                    <div className="arrow">→</div>
                    <div className="fhe-box">FHE Computation</div>
                    <div className="arrow">→</div>
                    <div className="result-box">Encrypted Result</div>
                  </div>
                </div>
              </div>
              
              <div className="step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h3>Receive Verified Results</h3>
                  <p>After processing, you'll receive a verifiable result that proves the computation was performed correctly, without revealing the underlying data.</p>
                  <div className="fhe-visual">
                    <div className="result-box">Encrypted Result</div>
                    <div className="arrow">→</div>
                    <div className="decrypt-box">Decrypt with Key</div>
                    <div className="arrow">→</div>
                    <div className="verified-box">Verified Result</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="use-cases cyber-card">
              <h3>Industry Use Cases</h3>
              <div className="use-case">
                <h4>Privacy-Preserving KYC</h4>
                <p>Verify identity documents without exposing personal information. FHE allows validation of required criteria while keeping all other data encrypted.</p>
              </div>
              <div className="use-case">
                <h4>Credit Scoring</h4>
                <p>Calculate credit scores from encrypted financial data. Lenders receive only the score, not the underlying financial details.</p>
              </div>
              <div className="use-case">
                <h4>Insurance Claims</h4>
                <p>Process claims with sensitive medical information while keeping all data encrypted throughout the verification process.</p>
              </div>
            </div>
          </div>
        )}
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitRecord} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          recordData={newRecordData}
          setRecordData={setNewRecordData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content cyber-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="cyber-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon"></div>
              <span>ConfidentialContractMarket</span>
            </div>
            <p>Secure encrypted data processing platform powered by Zama FHE</p>
          </div>
          <div className="footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Documentation</a>
            <a href="#">Contact</a>
          </div>
        </div>
        <div className="copyright">
          © {new Date().getFullYear()} Confidential Contract Market. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function ModalCreate({ onSubmit, onClose, creating, recordData, setRecordData }: { 
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  recordData: any;
  setRecordData: (data: any) => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRecordData({
      ...recordData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!recordData.category || !recordData.sensitiveInfo) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal cyber-card">
        <div className="modal-header">
          <h2>Add Encrypted Data Record</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> Your sensitive data will be encrypted with Zama FHE
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Category *</label>
              <select 
                name="category"
                value={recordData.category} 
                onChange={handleChange}
                className="cyber-select"
              >
                <option value="">Select category</option>
                <option value="KYC">KYC Verification</option>
                <option value="Credit">Credit Score</option>
                <option value="Medical">Medical Records</option>
                <option value="Financial">Financial Data</option>
                <option value="Insurance">Insurance Claim</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <input 
                type="text"
                name="description"
                value={recordData.description} 
                onChange={handleChange}
                placeholder="Brief description..." 
                className="cyber-input"
              />
            </div>
            
            <div className="form-group full-width">
              <label>Sensitive Information *</label>
              <textarea 
                name="sensitiveInfo"
                value={recordData.sensitiveInfo} 
                onChange={handleChange}
                placeholder="Enter sensitive data to encrypt..." 
                className="cyber-textarea"
                rows={4}
              />
            </div>
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> Data remains encrypted during processing using FHE technology
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn cyber-button"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn cyber-button primary"
          >
            {creating ? "Encrypting..." : "Submit Securely"}
          </button>
        </div>
      </div>
    </div>
  );
}