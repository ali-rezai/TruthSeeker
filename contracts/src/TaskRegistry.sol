// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OperatorRegistry.sol";

/**
 * @title TaskRegistry
 * @dev A contract for registering tasks with claims that need verification
 */
contract TaskRegistry {
    OperatorRegistry public operatorRegistry;

    // Enum for claim verification result
    enum ClaimVerificationResult {
        PENDING,
        TRUE,
        FALSE,
        DEPENDS,
        INCONCLUSIVE,
        TOO_EARLY
    }

    // Task structure
    struct Task {
        string claim;
        uint256 timestamp;
        ClaimVerificationResult verificationResult;
    }

    // State variables
    uint256 public submissionFee;
    uint256 public taskCount;
    
    // Mapping from taskId to Task
    mapping(uint256 => Task) public tasks;
    
    // Events
    event TaskSubmitted(uint256 indexed taskId, string claim, uint256 timestamp);
    event TaskUpdated(uint256 indexed taskId, ClaimVerificationResult verificationResult);

    /**
     * @dev Constructor sets the submission fee and owner
     * @param _submissionFee The fee required to submit a task
     */
    constructor(uint256 _submissionFee, address _operatorRegistry) {
        operatorRegistry = OperatorRegistry(_operatorRegistry);
        submissionFee = _submissionFee;
        taskCount = 0;
    }

    /**
     * @dev Submit a new task with a claim to be verified
     * @param _claim The claim to be verified
     */
    function submitTask(string memory _claim) external payable {
        require(msg.value >= submissionFee, "TaskRegistry: insufficient fee");
        
        uint256 taskId = taskCount;
        tasks[taskId] = Task({
            claim: _claim,
            timestamp: block.timestamp,
            verificationResult: ClaimVerificationResult.PENDING
        });
        
        taskCount++;
        emit TaskSubmitted(taskId, _claim, block.timestamp);
    }

    /**
     * @dev Get task details
     * @param _taskId The ID of the task
     * @return claim The claim to be verified
     * @return timestamp The timestamp when the task was submitted
     * @return verificationResult The result of the claim verification
     */
    function getTask(uint256 _taskId) external view returns (
        string memory claim,
        uint256 timestamp,
        ClaimVerificationResult verificationResult
    ) {
        require(_taskId < taskCount, "TaskRegistry: task does not exist");
        Task storage task = tasks[_taskId];
        return (task.claim, task.timestamp, task.verificationResult);
    }

    /**
     * @dev Submit task verification result
     * @param _taskId The ID of the task to verify
     * @param _verificationResult The result of the claim verification
     */
    function submitVerificationResult(uint256 _taskId, ClaimVerificationResult _verificationResult, bytes calldata _teeRaQuote) external {
        require(_taskId < taskCount, "TaskRegistry: task does not exist");
        require(tasks[_taskId].verificationResult == ClaimVerificationResult.PENDING, "TaskRegistry: task already verified");
        require(_verificationResult != ClaimVerificationResult.PENDING, "TaskRegistry: verification result cannot be PENDING");
        
        // TODO: Verify TEE RA Quote based on OperatorRegistryStorage constants and the rtmr3 in msg.sender's operator info

        tasks[_taskId].verificationResult = _verificationResult;
        
        (bool success, ) = msg.sender.call{value: submissionFee}("");
        require(success, "TaskRegistry: payment failed");
        
        emit TaskUpdated(_taskId, _verificationResult);
    }
}
