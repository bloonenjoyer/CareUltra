// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title PrivacyKYC - Confidential KYC Verification System
 * @dev Uses FHE to process sensitive KYC data while maintaining encryption
 * Features:
 *  - Encrypted identity attribute storage
 *  - Homomorphic qualification verification
 *  - Minimal disclosure mechanisms
 *  - Industry-specific privacy modules
 */
contract PrivacyKYC is SepoliaConfig {
    // Encrypted user profile attributes
    struct EncryptedUser {
        euint32 age;            // Encrypted age
        euint32 creditScore;    // Encrypted credit score
        euint32 income;         // Encrypted income
        ebool isVerified;       // Encrypted verification status
        euint32 industryData;   // Industry-specific encrypted data
    }
    
    // Minimal disclosure structure for compliance
    struct Disclosure {
        bool ageRevealed;
        bool creditRevealed;
        bool incomeRevealed;
        bool verificationRevealed;
    }

    // Contract state
    mapping(address => EncryptedUser) private encryptedUsers;
    mapping(address => Disclosure) public disclosures;
    mapping(address => bool) public isRegistered;
    
    // Industry-specific modules
    address public insuranceModule;
    address public lendingModule;
    
    // Verification authorities
    mapping(address => bool) public verifiers;
    
    // Events
    event UserRegistered(address indexed user);
    attribute VerificationCompleted(address indexed user);
    event DataDisclosed(address indexed user, string dataType);
    event IndustryDataProcessed(address indexed user, bytes32 processId);

    modifier onlyVerifier() {
        require(verifiers[msg.sender], "Not authorized verifier");
        _;
    }

    modifier onlyModule() {
        require(msg.sender == insuranceModule || msg.sender == lendingModule, "Not authorized module");
        _;
    }

    /// @notice Register user with encrypted KYC data
    function registerUser(
        euint32 encryptedAge,
        euint32 encryptedCreditScore,
        euint32 encryptedIncome
    ) public {
        require(!isRegistered[msg.sender], "Already registered");
        
        encryptedUsers[msg.sender] = EncryptedUser({
            age: encryptedAge,
            creditScore: encryptedCreditScore,
            income: encryptedIncome,
            isVerified: FHE.asEbool(false),
            industryData: FHE.asEuint32(0)
        });
        
        disclosures[msg.sender] = Disclosure({
            ageRevealed: false,
            creditRevealed: false,
            incomeRevealed: false,
            verificationRevealed: false
        });
        
        isRegistered[msg.sender] = true;
        emit UserRegistered(msg.sender);
    }

    /// @notice Verifier updates encrypted KYC attributes
    function updateUserData(
        address user,
        euint32 newCreditScore,
        euint32 newIncome,
        ebool verificationStatus
    ) public onlyVerifier {
        require(isRegistered[user], "User not registered");
        
        EncryptedUser storage data = encryptedUsers[user];
        data.creditScore = newCreditScore;
        data.income = newIncome;
        data.isVerified = verificationStatus;
        
        emit VerificationCompleted(user);
    }

    /// @notice Homomorphic credit score check
    function checkCreditThreshold(address user, euint32 threshold) public view returns (ebool) {
        require(isRegistered[user], "User not registered");
        return FHE.gt(encryptedUsers[user].creditScore, threshold);
    }

    /// @notice Homomorphic income verification
    function verifyIncomeRange(address user, euint32 minIncome, euint32 maxIncome) public view returns (ebool) {
        require(isRegistered[user], "User not registered");
        EncryptedUser storage data = encryptedUsers[user];
        
        ebool aboveMin = FHE.gt(data.income, minIncome);
        ebool belowMax = FHE.lt(data.income, maxIncome);
        
        return FHE.and(aboveMin, belowMax);
    }

    /// @notice Minimal disclosure function (user-controlled)
    function discloseData(string memory dataType) public {
        require(isRegistered[msg.sender], "Not registered");
        
        if (keccak256(abi.encodePacked(dataType)) == keccak256(abi.encodePacked("age"))) {
            disclosures[msg.sender].ageRevealed = true;
        } else if (keccak256(abi.encodePacked(dataType)) == keccak256(abi.encodePacked("credit"))) {
            disclosures[msg.sender].creditRevealed = true;
        } else if (keccak256(abi.encodePacked(dataType)) == keccak256(abi.encodePacked("income"))) {
            disclosures[msg.sender].incomeRevealed = true;
        } else if (keccak256(abi.encodePacked(dataType)) == keccak256(abi.encodePacked("verification"))) {
            disclosures[msg.sender].verificationRevealed = true;
        }
        
        emit DataDisclosed(msg.sender, dataType);
    }

    /// @notice Industry-specific data processing (insurance example)
    function processInsuranceClaim(address user, euint32 encryptedClaimAmount) public onlyModule {
        require(isRegistered[user], "User not registered");
        
        // Homomorphic risk assessment calculation
        euint32 riskScore = FHE.div(
            FHE.mul(encryptedUsers[user].age, encryptedClaimAmount), 
            FHE.asEuint32(1000)
        );
        
        // Store result in encrypted storage
        encryptedUsers[user].industryData = riskScore;
        
        emit IndustryDataProcessed(user, keccak256(abi.encodePacked("insurance_claim")));
    }

    /// @notice Add trusted verification authority
    function addVerifier(address verifier) public {
        // In production: require admin privileges
        verifiers[verifier] = true;
    }

    /// @notice Configure industry modules
    function setIndustryModule(address moduleAddress, string memory moduleType) public {
        // In production: require admin privileges
        if (keccak256(abi.encodePacked(moduleType)) == keccak256(abi.encodePacked("insurance"))) {
            insuranceModule = moduleAddress;
        } else if (keccak256(abi.encodePacked(moduleType)) == keccak256(abi.encodePacked("lending"))) {
            lendingModule = moduleAddress;
        }
    }
}