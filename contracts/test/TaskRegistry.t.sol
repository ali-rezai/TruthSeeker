// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TaskRegistry.sol";

contract TaskRegistryTest is Test {
    TaskRegistry public taskRegistry;
    address public owner;
    address public user1;
    address public user2;
    uint256 public submissionFee = 0.01 ether;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // Fund test users
        vm.deal(user1, 1 ether);
        vm.deal(user2, 1 ether);
        
        // Deploy contract
        OperatorRegistry operatorRegistry = new OperatorRegistry(0.1 ether);
        taskRegistry = new TaskRegistry(submissionFee, address(operatorRegistry));
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
        taskRegistry.submitVerificationResult(0, TaskRegistry.ClaimVerificationResult.TRUE, bytes(""));
        
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
        taskRegistry.submitVerificationResult(0, TaskRegistry.ClaimVerificationResult.TRUE, bytes(""));
        
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
        vm.expectRevert("TaskRegistry: verification result cannot be PENDING");
        taskRegistry.submitVerificationResult(0, TaskRegistry.ClaimVerificationResult.PENDING, bytes(""));
    }

    function testGetNonExistentTask() public {
        vm.expectRevert("TaskRegistry: task does not exist");
        taskRegistry.getTask(0);
    }

    // Fallback function to receive ETH
    receive() external payable {}
}