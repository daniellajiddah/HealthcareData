import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Client,
  Provider,
  Receipt,
  Result,
  Account
} from '@stacks/clarity';
import { 
  principalCV,
  uintCV,
  bufferCV,
  trueCV,
  falseCV,
  listCV,
} from '@stacks/transactions';

describe('Healthcare Data Marketplace Contract', () => {
  let client: Client;
  let provider: Provider;

  // Test accounts
  let deployer: Account;
  let user: Account;
  let researcher: Account;

  // Test data
  const dataHash = Buffer.from('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 'hex');
  const dataPrice = 1000;

  beforeEach(async () => {
    provider = await Provider.fromLocal();
    client = new Client('ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.healthcare-marketplace', 'healthcare-marketplace', provider);
    
    // Setup test accounts
    [deployer, user, researcher] = await Promise.all([
      provider.newAccount(),
      provider.newAccount(),
      provider.newAccount()
    ]);

    // Deploy contract
    await client.deployContract();
  });

  describe('Token Operations', () => {
    it('should initialize with correct token supply', async () => {
      const query = client.createQuery({
        method: { 
          name: 'get-total-supply', 
          args: [] 
        }
      });
      const receipt = await client.submitQuery(query);
      const result = Result.unwrapUInt(receipt);
      
      expect(result).toBe(1000000000n);
    });

    it('should allow token transfers between accounts', async () => {
      // First mint tokens to user
      const mintTx = client.createTransaction({
        method: {
          name: 'mint',
          args: [
            principalCV(user.address),
            uintCV(2000)
          ]
        }
      });
      await client.submitTransaction(mintTx);

      // Transfer tokens from user to researcher
      const transferTx = client.createTransaction({
        method: {
          name: 'transfer',
          args: [
            principalCV(researcher.address),
            uintCV(1000)
          ]
        }
      });
      transferTx.sign(user.privateKey);
      
      const receipt = await client.submitTransaction(transferTx);
      expect(receipt.success).toBe(true);
    });
  });

  describe('Data Management', () => {
    it('should allow users to submit health data', async () => {
      const tx = client.createTransaction({
        method: {
          name: 'submit-health-data',
          args: [
            bufferCV(dataHash),
            uintCV(dataPrice)
          ]
        }
      });
      
      tx.sign(user.privateKey);
      const receipt = await client.submitTransaction(tx);
      expect(receipt.success).toBe(true);
    });

    it('should allow users to update data availability', async () => {
      // First submit data
      await submitTestData(client, user, dataHash, dataPrice);
      
      const tx = client.createTransaction({
        method: {
          name: 'set-data-availability',
          args: [falseCV()]
        }
      });
      
      tx.sign(user.privateKey);
      const receipt = await client.submitTransaction(tx);
      expect(receipt.success).toBe(true);
    });

    it('should prevent unauthorized access to data', async () => {
      await submitTestData(client, user, dataHash, dataPrice);
      
      const query = client.createQuery({
        method: {
          name: 'get-data-access-status',
          args: [
            principalCV(researcher.address),
            principalCV(user.address)
          ]
        }
      });
      
      const receipt = await client.submitQuery(query);
      expect(Result.unwrapBool(receipt)).toBe(false);
    });
  });

  describe('Researcher Operations', () => {
    it('should allow researchers to register', async () => {
      const tx = client.createTransaction({
        method: {
          name: 'register-researcher',
          args: []
        }
      });
      
      tx.sign(researcher.privateKey);
      const receipt = await client.submitTransaction(tx);
      expect(receipt.success).toBe(true);
    });

    it('should only allow contract owner to verify researchers', async () => {
      // Register researcher first
      await registerResearcher(client, researcher);
      
      // Try to verify with non-owner
      const failTx = client.createTransaction({
        method: {
          name: 'verify-researcher',
          args: [principalCV(researcher.address)]
        }
      });
      
      failTx.sign(user.privateKey);
      const failReceipt = await client.submitTransaction(failTx);
      expect(failReceipt.success).toBe(false);
      
      // Verify with owner
      const successTx = client.createTransaction({
        method: {
          name: 'verify-researcher',
          args: [principalCV(researcher.address)]
        }
      });
      
      successTx.sign(deployer.privateKey);
      const successReceipt = await client.submitTransaction(successTx);
      expect(successReceipt.success).toBe(true);
    });
  });

  describe('Data Purchase Flow', () => {
    beforeEach(async () => {
      // Setup: Submit data, register and verify researcher
      await submitTestData(client, user, dataHash, dataPrice);
      await registerResearcher(client, researcher);
      await verifyResearcher(client, researcher, deployer);
      await mintTokens(client, researcher, 2000);
    });

    it('should allow verified researchers to purchase data', async () => {
      const tx = client.createTransaction({
        method: {
          name: 'purchase-data',
          args: [
            principalCV(user.address),
            uintCV(dataPrice)
          ]
        }
      });
      
      tx.sign(researcher.privateKey);
      const receipt = await client.submitTransaction(tx);
      expect(receipt.success).toBe(true);
      
      // Verify token transfer
      const balanceQuery = client.createQuery({
        method: {
          name: 'get-balance',
          args: [principalCV(user.address)]
        }
      });
      
      const balanceReceipt = await client.submitQuery(balanceQuery);
      expect(Result.unwrapUInt(balanceReceipt)).toBe(BigInt(dataPrice));
    });

    it('should fail purchase with insufficient funds', async () => {
      const tx = client.createTransaction({
        method: {
          name: 'purchase-data',
          args: [
            principalCV(user.address),
            uintCV(dataPrice * 2) // Try to purchase with more than available tokens
          ]
        }
      });
      
      tx.sign(researcher.privateKey);
      const receipt = await client.submitTransaction(tx);
      expect(receipt.success).toBe(false);
    });
  });
});

// Helper functions
async function submitTestData(
  client: Client, 
  user: Account, 
  dataHash: Buffer, 
  price: number
): Promise<Receipt> {
  const tx = client.createTransaction({
    method: {
      name: 'submit-health-data',
      args: [
        bufferCV(dataHash),
        uintCV(price)
      ]
    }
  });
  tx.sign(user.privateKey);
  return client.submitTransaction(tx);
}

async function registerResearcher(
  client: Client, 
  researcher: Account
): Promise<Receipt> {
  const tx = client.createTransaction({
    method: {
      name: 'register-researcher',
      args: []
    }
  });
  tx.sign(researcher.privateKey);
  return client.submitTransaction(tx);
}

async function verifyResearcher(
  client: Client, 
  researcher: Account, 
  owner: Account
): Promise<Receipt> {
  const tx = client.createTransaction({
    method: {
      name: 'verify-researcher',
      args: [principalCV(researcher.address)]
    }
  });
  tx.sign(owner.privateKey);
  return client.submitTransaction(tx);
}

async function mintTokens(
  client: Client, 
  account: Account, 
  amount: number
): Promise<Receipt> {
  const tx = client.createTransaction({
    method: {
      name: 'mint',
      args: [
        principalCV(account.address),
        uintCV(amount)
      ]
    }
  });
  tx.sign(client.provider.getDefaultAccount().privateKey);
  return client.submitTransaction(tx);
}