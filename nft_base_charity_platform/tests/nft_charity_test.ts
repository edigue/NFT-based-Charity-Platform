import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure that NFT minting creates tokens with correct metadata",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/art1.json"),
                types.utf8("digital-art")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.uint(1));
        
        // Verify token ownership
        let ownerCall = chain.callReadOnlyFn('nft_charity', 'get-owner', [types.uint(1)], wallet1.address);
        assertEquals(ownerCall.result.expectSome(), wallet1.address);
        
        // Verify token URI
        let uriCall = chain.callReadOnlyFn('nft_charity', 'get-token-uri', [types.uint(1)], wallet1.address);
        assertEquals(uriCall.result.expectSome(), types.utf8("https://example.com/art1.json"));
        
        // Verify metadata
        let metadataCall = chain.callReadOnlyFn('nft_charity', 'get-token-metadata', [types.uint(1)], wallet1.address);
        let metadata = metadataCall.result.expectSome().expectTuple();
        assertEquals(metadata['creator'], wallet1.address);
        assertEquals(metadata['category'], types.utf8("digital-art"));
        assertEquals(metadata['timestamp'], types.uint(2));
    },
});

Clarinet.test({
    name: "Ensure that multiple NFTs can be minted by different users",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let wallet1 = accounts.get('wallet_1')!;
        let wallet2 = accounts.get('wallet_2')!;
        let wallet3 = accounts.get('wallet_3')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/art1.json"),
                types.utf8("digital-art")
            ], wallet1.address),
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/music1.json"),
                types.utf8("music")
            ], wallet2.address),
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/photo1.json"),
                types.utf8("photography")
            ], wallet3.address)
        ]);
        
        assertEquals(block.receipts.length, 3);
        assertEquals(block.receipts[0].result.expectOk(), types.uint(1));
        assertEquals(block.receipts[1].result.expectOk(), types.uint(2));
        assertEquals(block.receipts[2].result.expectOk(), types.uint(3));
        
        // Verify different owners
        let owner1 = chain.callReadOnlyFn('nft_charity', 'get-owner', [types.uint(1)], wallet1.address);
        let owner2 = chain.callReadOnlyFn('nft_charity', 'get-owner', [types.uint(2)], wallet1.address);
        let owner3 = chain.callReadOnlyFn('nft_charity', 'get-owner', [types.uint(3)], wallet1.address);
        
        assertEquals(owner1.result.expectSome(), wallet1.address);
        assertEquals(owner2.result.expectSome(), wallet2.address);
        assertEquals(owner3.result.expectSome(), wallet3.address);
    },
});

Clarinet.test({
    name: "Ensure that NFT transfer works correctly between users",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let wallet1 = accounts.get('wallet_1')!;
        let wallet2 = accounts.get('wallet_2')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/art1.json"),
                types.utf8("digital-art")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts[0].result.expectOk(), types.uint(1));
        
        // Transfer NFT
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'transfer', [
                types.uint(1),
                types.principal(wallet2.address)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify new ownership
        let ownerCall = chain.callReadOnlyFn('nft_charity', 'get-owner', [types.uint(1)], wallet1.address);
        assertEquals(ownerCall.result.expectSome(), wallet2.address);
    },
});

Clarinet.test({
    name: "Ensure that only token owner can transfer NFT",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let wallet1 = accounts.get('wallet_1')!;
        let wallet2 = accounts.get('wallet_2')!;
        let wallet3 = accounts.get('wallet_3')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/art1.json"),
                types.utf8("digital-art")
            ], wallet1.address)
        ]);
        
        // Try to transfer from non-owner account
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'transfer', [
                types.uint(1),
                types.principal(wallet3.address)
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(101)); // err-not-token-owner
    },
});

Clarinet.test({
    name: "Ensure that NFT listing for sale works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let wallet1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/art1.json"),
                types.utf8("digital-art")
            ], wallet1.address)
        ]);
        
        // List NFT for sale
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'list-for-sale', [
                types.uint(1),
                types.uint(1000000) // 1 STX in microSTX
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify price is set
        let priceCall = chain.callReadOnlyFn('nft_charity', 'get-price', [types.uint(1)], wallet1.address);
        assertEquals(priceCall.result.expectSome(), types.uint(1000000));
    },
});

Clarinet.test({
    name: "Ensure that only token owner can list NFT for sale",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let wallet1 = accounts.get('wallet_1')!;
        let wallet2 = accounts.get('wallet_2')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/art1.json"),
                types.utf8("digital-art")
            ], wallet1.address)
        ]);
        
        // Try to list from non-owner account
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'list-for-sale', [
                types.uint(1),
                types.uint(1000000)
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(101)); // err-not-token-owner
    },
});

Clarinet.test({
    name: "Ensure that NFT purchase works with automatic charity donation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let wallet1 = accounts.get('wallet_1')!;
        let wallet2 = accounts.get('wallet_2')!;
        
        // Mint and list NFT
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/art1.json"),
                types.utf8("digital-art")
            ], wallet1.address),
            Tx.contractCall('nft_charity', 'list-for-sale', [
                types.uint(1),
                types.uint(1000000) // 1 STX
            ], wallet1.address)
        ]);
        
        // Buy NFT (20% goes to charity, 80% to seller)
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'buy-nft', [
                types.uint(1)
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify ownership transfer
        let ownerCall = chain.callReadOnlyFn('nft_charity', 'get-owner', [types.uint(1)], wallet2.address);
        assertEquals(ownerCall.result.expectSome(), wallet2.address);
        
        // Verify price is cleared after sale
        let priceCall = chain.callReadOnlyFn('nft_charity', 'get-price', [types.uint(1)], wallet2.address);
        assertEquals(priceCall.result, types.none());
    },
});

Clarinet.test({
    name: "Ensure that listing with invalid price fails",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let wallet1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/art1.json"),
                types.utf8("digital-art")
            ], wallet1.address)
        ]);
        
        // Try to list with zero price
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'list-for-sale', [
                types.uint(1),
                types.uint(0) // Invalid zero price
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(103)); // err-invalid-price
    },
});

Clarinet.test({
    name: "Ensure that charity campaign creation works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'create-charity-campaign', [
                types.utf8("Save the Ocean"),
                types.utf8("Help us clean up ocean plastic and protect marine life"),
                types.uint(50000000), // 50 STX goal
                types.uint(8640) // ~60 days duration
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.uint(1));
        
        // Verify campaign details
        let campaignCall = chain.callReadOnlyFn('nft_charity', 'get-campaign-details', [types.uint(1)], deployer.address);
        let campaign = campaignCall.result.expectSome().expectTuple();
        assertEquals(campaign['name'], types.utf8("Save the Ocean"));
        assertEquals(campaign['goal'], types.uint(50000000));
        assertEquals(campaign['raised'], types.uint(0));
        assertEquals(campaign['active'], types.bool(true));
    },
});

Clarinet.test({
    name: "Ensure that only contract owner can create charity campaigns",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let wallet1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'create-charity-campaign', [
                types.utf8("Unauthorized Campaign"),
                types.utf8("This should fail"),
                types.uint(1000000),
                types.uint(100)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(100)); // err-owner-only
    },
});

Clarinet.test({
    name: "Ensure that campaign creation with invalid parameters fails",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'create-charity-campaign', [
                types.utf8("Invalid Campaign"),
                types.utf8("Should fail with zero goal"),
                types.uint(0), // Invalid zero goal
                types.uint(100)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(107)); // err-invalid-parameter
    },
});

Clarinet.test({
    name: "Ensure that donation to charity campaign works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Create campaign first
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'create-charity-campaign', [
                types.utf8("Save the Forest"),
                types.utf8("Help us plant trees and protect forests"),
                types.uint(10000000), // 10 STX goal
                types.uint(1000) // Duration
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts[0].result.expectOk(), types.uint(1));
        
        // Donate to campaign
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'donate-to-campaign', [
                types.uint(1),
                types.uint(2000000) // 2 STX donation
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify campaign raised amount updated
        let campaignCall = chain.callReadOnlyFn('nft_charity', 'get-campaign-details', [types.uint(1)], wallet1.address);
        let campaign = campaignCall.result.expectSome().expectTuple();
        assertEquals(campaign['raised'], types.uint(2000000));
        
        // Verify donation history
        let donationCall = chain.callReadOnlyFn('nft_charity', 'get-user-donation-history', [
            types.principal(wallet1.address),
            types.uint(1)
        ], wallet1.address);
        let donation = donationCall.result.expectSome().expectTuple();
        assertEquals(donation['amount'], types.uint(2000000));
    },
});

Clarinet.test({
    name: "Ensure that donation to non-existent campaign fails",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let wallet1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'donate-to-campaign', [
                types.uint(999), // Non-existent campaign
                types.uint(1000000)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(104)); // err-campaign-not-found
    },
});

Clarinet.test({
    name: "Ensure that donation to inactive campaign fails",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Create and end campaign
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'create-charity-campaign', [
                types.utf8("Test Campaign"),
                types.utf8("Test description"),
                types.uint(1000000),
                types.uint(100)
            ], deployer.address)
        ]);
        
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'end-campaign', [
                types.uint(1)
            ], deployer.address)
        ]);
        
        // Try to donate to ended campaign
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'donate-to-campaign', [
                types.uint(1),
                types.uint(500000)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(104)); // err-campaign-not-found
    },
});

Clarinet.test({
    name: "Ensure that campaign can be ended by contract owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        
        // Create campaign
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'create-charity-campaign', [
                types.utf8("Test Campaign"),
                types.utf8("Test description"),
                types.uint(1000000),
                types.uint(100)
            ], deployer.address)
        ]);
        
        // End campaign
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'end-campaign', [
                types.uint(1)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify campaign is inactive
        let campaignCall = chain.callReadOnlyFn('nft_charity', 'get-campaign-details', [types.uint(1)], deployer.address);
        let campaign = campaignCall.result.expectSome().expectTuple();
        assertEquals(campaign['active'], types.bool(false));
    },
});

Clarinet.test({
    name: "Ensure that only owner can end campaigns",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Create campaign
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'create-charity-campaign', [
                types.utf8("Test Campaign"),
                types.utf8("Test description"),
                types.uint(1000000),
                types.uint(100)
            ], deployer.address)
        ]);
        
        // Try to end campaign from non-owner account
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'end-campaign', [
                types.uint(1)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(100)); // err-owner-only
    },
});

Clarinet.test({
    name: "Ensure that charity address can be updated by owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'set-charity-address', [
                types.principal(wallet1.address)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
    },
});

Clarinet.test({
    name: "Ensure that donation percentage can be updated by owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'set-donation-percentage', [
                types.uint(30) // 30%
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
    },
});

Clarinet.test({
    name: "Ensure that donation percentage cannot exceed 100%",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'set-donation-percentage', [
                types.uint(150) // 150% - should fail
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(104));
    },
});

Clarinet.test({
    name: "Ensure that contract can be paused and unpaused by owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Pause contract
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'toggle-pause', [], deployer.address)
        ]);
        
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Try to mint while paused - should fail
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/art1.json"),
                types.utf8("digital-art")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts[0].result.expectErr(), types.uint(108));
        
        // Unpause contract
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'toggle-pause', [], deployer.address)
        ]);
        
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Minting should work now
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/art1.json"),
                types.utf8("digital-art")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts[0].result.expectOk(), types.uint(1));
    },
});

Clarinet.test({
    name: "Ensure that non-owners cannot perform administrative functions",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let wallet1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'set-charity-address', [
                types.principal(wallet1.address)
            ], wallet1.address),
            Tx.contractCall('nft_charity', 'set-donation-percentage', [
                types.uint(25)
            ], wallet1.address),
            Tx.contractCall('nft_charity', 'toggle-pause', [], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 3);
        // All should fail with owner-only error
        assertEquals(block.receipts[0].result.expectErr(), types.uint(100));
        assertEquals(block.receipts[1].result.expectErr(), types.uint(100));
        assertEquals(block.receipts[2].result.expectErr(), types.uint(100));
    },
});

Clarinet.test({
    name: "Ensure that complete NFT marketplace flow works with charity integration",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let creator = accounts.get('wallet_1')!;
        let buyer = accounts.get('wallet_2')!;
        
        // Create charity campaign
        let block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'create-charity-campaign', [
                types.utf8("Art for Charity"),
                types.utf8("Supporting artists and charity through NFT sales"),
                types.uint(5000000), // 5 STX goal
                types.uint(1000)
            ], deployer.address)
        ]);
        
        // Mint, list, and sell NFT
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'mint', [
                types.utf8("https://example.com/masterpiece.json"),
                types.utf8("fine-art")
            ], creator.address),
            Tx.contractCall('nft_charity', 'list-for-sale', [
                types.uint(1),
                types.uint(5000000) // 5 STX price
            ], creator.address)
        ]);
        
        // Buy NFT (1 STX goes to charity, 4 STX to creator)
        block = chain.mineBlock([
            Tx.contractCall('nft_charity', 'buy-nft', [
                types.uint(1)
            ], buyer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify final ownership
        let ownerCall = chain.callReadOnlyFn('nft_charity', 'get-owner', [types.uint(1)], buyer.address);
        assertEquals(ownerCall.result.expectSome(), buyer.address);
        
        // Verify campaign still active and accepting donations
        let campaignCall = chain.callReadOnlyFn('nft_charity', 'get-campaign-details', [types.uint(1)], deployer.address);
        let campaign = campaignCall.result.expectSome().expectTuple();
        assertEquals(campaign['active'], types.bool(true));
    },
});