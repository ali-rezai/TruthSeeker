// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TaskRegistry.sol";

contract DeployTaskRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy with a submission fee of 0.01 ether
        TaskRegistry taskRegistry = new TaskRegistry(0.01 ether);
        
        vm.stopBroadcast();

        console.log("TaskRegistry deployed at:", address(taskRegistry));
    }
} 
