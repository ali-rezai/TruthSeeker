// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TaskRegistry.sol";
import "@automata-network/dcap-attestation/verifiers/V4QuoteVerifier.sol";
import "automata-dcap-attestation/forge-test/utils/PCCSSetupBase.sol";

contract TaskRegistryTest is PCCSSetupBase {
    TaskRegistry public taskRegistry;
    AutomataDcapAttestation public automataDcapAttestation;
    OperatorRegistry public operatorRegistry;
    address public owner;
    address public user1;
    address public user2;
    uint256 public registrationFee = 0.1 ether;
    uint256 public submissionFee = 0.01 ether;
    bytes public sampleQuote = vm.readFileBinary(string.concat(vm.projectRoot(), "/test/assets/quote.bin"));

    function setUp() public override {
        super.setUp();
        vm.startPrank(admin);

        // PCCS Setup
        PCCSRouter pccsRouter = setupPccsRouter();
        pcsDaoUpserts();
        
        // collateral upserts
        vm.warp(1740947347);
        string memory tcbInfoPath = "/test/assets/tcbinfo.json";
        string memory qeIdPath = "/test/assets/identity.json";
        qeIdDaoUpsert(4, qeIdPath);
        fmspcTcbDaoUpsert(tcbInfoPath);

        automataDcapAttestation = new AutomataDcapAttestation(0x0000000000000000000000000000000000000000, bytes32(0));

        V4QuoteVerifier v4QuoteVerifier = new V4QuoteVerifier(address(pccsRouter));
        automataDcapAttestation.setQuoteVerifier(address(v4QuoteVerifier));
        
        vm.stopPrank();

        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // Fund test users
        vm.deal(user1, 1 ether);
        vm.deal(user2, 1 ether);
        
        // Deploy contract
        operatorRegistry = new OperatorRegistry(registrationFee, address(automataDcapAttestation));
        taskRegistry = new TaskRegistry(submissionFee, address(operatorRegistry), address(automataDcapAttestation));
    }

    function testSubmitTask() public {
        string memory claim = "The sky is blue";
        
        // Submit task as user1
        vm.prank(user1);
        taskRegistry.submitTask{value: submissionFee}(claim);
        
        // Check task was created correctly
        (string memory taskClaim, uint256 timestamp, TaskRegistry.ClaimVerificationResult verificationResult) = taskRegistry.getTask(0);
        
        assertEq(taskClaim, claim);
        assertGt(timestamp, 0);
        assertEq(uint(verificationResult), uint(TaskRegistry.ClaimVerificationResult.PENDING));
        assertEq(taskRegistry.taskCount(), 1);
    }

    function testSubmitTaskInsufficientFee() public {
        string memory claim = "The sky is blue";
        
        // Try to submit with insufficient fee
        vm.prank(user1);
        vm.expectRevert("TaskRegistry: insufficient fee");
        taskRegistry.submitTask{value: submissionFee - 0.001 ether}(claim);
    }

    function testVerifyTask() public {
        // First submit a task
        string memory claim = "The sky is blue";
        vm.prank(user1);
        taskRegistry.submitTask{value: submissionFee}(claim);
        
        // Verify the task as true
        vm.startPrank(user2);
        operatorRegistry.registerOperator{value: registrationFee}(sampleQuote, hex"d0d8ca1f66206a4dd8254e0b324959baa5e158f4766f14e95a2098b3183965d8aafa6ae8e474023a9ab56bfa61f75ce1", hex"d821f90b6cab2a8e6a5d899a607b80b7edabb20764c59667a2f2c51c3c449e736398990bcb7c4563c5ea9f2e38189e13");
        taskRegistry.submitVerificationResult(0, TaskRegistry.ClaimVerificationResult.TRUE, sampleQuote);
        vm.stopPrank();
        
        // Check task was verified correctly
        (,, TaskRegistry.ClaimVerificationResult verificationResult) = taskRegistry.getTask(0);
        assertEq(uint(verificationResult), uint(TaskRegistry.ClaimVerificationResult.TRUE));
    }

    function testVerifyTaskAlreadyVerified() public {
        // First submit a task
        string memory claim = "The sky is blue";
        vm.prank(user1);
        taskRegistry.submitTask{value: submissionFee}(claim);
        
        // Verify the task first time
        vm.startPrank(user2);
        operatorRegistry.registerOperator{value: registrationFee}(sampleQuote, hex"d0d8ca1f66206a4dd8254e0b324959baa5e158f4766f14e95a2098b3183965d8aafa6ae8e474023a9ab56bfa61f75ce1", hex"d821f90b6cab2a8e6a5d899a607b80b7edabb20764c59667a2f2c51c3c449e736398990bcb7c4563c5ea9f2e38189e13");
        taskRegistry.submitVerificationResult(0, TaskRegistry.ClaimVerificationResult.TRUE, sampleQuote);
        vm.stopPrank();
        
        // Try to verify again
        vm.expectRevert("TaskRegistry: task already verified");
        taskRegistry.submitVerificationResult(0, TaskRegistry.ClaimVerificationResult.FALSE, bytes(""));
    }

    function testVerifyTaskInvalidResult() public {
        // First submit a task
        string memory claim = "The sky is blue";
        vm.prank(user1);
        taskRegistry.submitTask{value: submissionFee}(claim);
        
        // Try to verify with PENDING result
        vm.prank(user2);
        vm.expectRevert("TaskRegistry: verification result cannot be PENDING");
        taskRegistry.submitVerificationResult(0, TaskRegistry.ClaimVerificationResult.PENDING, bytes(""));
    }

    function testGetNonExistentTask() public {
        vm.expectRevert("TaskRegistry: task does not exist");
        taskRegistry.getTask(0);
    }
}
