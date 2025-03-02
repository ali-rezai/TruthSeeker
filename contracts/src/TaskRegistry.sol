// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OperatorRegistry.sol";
import "@automata-network/dcap-attestation/AutomataDcapAttestation.sol";

/**
 * @title TaskRegistry
 * @dev A contract for registering tasks with claims that need verification
 */
contract TaskRegistry {
    OperatorRegistry public operatorRegistry;
    AutomataDcapAttestation public automataDcapAttestation;

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
    constructor(uint256 _submissionFee, address _operatorRegistry, address _automataDcapAttestation) {
        operatorRegistry = OperatorRegistry(_operatorRegistry);
        submissionFee = _submissionFee;
        taskCount = 0;
        automataDcapAttestation = AutomataDcapAttestation(_automataDcapAttestation);
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
    function submitVerificationResult(uint256 _taskId, ClaimVerificationResult _verificationResult, bytes memory _teeRaQuote) external {
        require(_taskId < taskCount, "TaskRegistry: task does not exist");
        require(tasks[_taskId].verificationResult == ClaimVerificationResult.PENDING, "TaskRegistry: task already verified");
        require(_verificationResult != ClaimVerificationResult.PENDING, "TaskRegistry: verification result cannot be PENDING");
        
        _verifyOperatorTeeRaQuote(_teeRaQuote, operatorRegistry.getOpeartorRtmr3(msg.sender));
        tasks[_taskId].verificationResult = _verificationResult;

        (bool success, ) = msg.sender.call{value: submissionFee}("");
        require(success, "TaskRegistry: payment failed");
        
        emit TaskUpdated(_taskId, _verificationResult);
    }

    function _verifyOperatorTeeRaQuote(bytes memory _teeRaQuote, bytes32 _rtmr3Hash) internal view {
        // Verify TEE RA Quote
        (bool success, bytes memory output) = automataDcapAttestation.verifyAndAttestOnChain(_teeRaQuote);
        if (!success) {
            revert(string(output));
        }

        // Extract RTMR3 from TEE RA Quote
        bytes memory rtmr3Bytes = new bytes(48);
        for (uint256 i = 520; i < 568; i++) {
            rtmr3Bytes[i - 520] = _teeRaQuote[i];
        }

        if (keccak256(rtmr3Bytes) != _rtmr3Hash) {
            revert("TaskRegistry: RTMR3 mismatch");
        }
    }
}
