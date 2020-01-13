
const ethers = require('ethers');
const AppConfig = require('../config.json');
const config = require('../config.json');
//const contract_abi = require('../contracts/DCToken.abi.json');
const argv = process.argv.slice(2);

const formatEther = ethers.utils.formatEther;

if (argv.length < 2) {
  console.log("Usage: find_incoming.js <src> <contract_addr>");
  process.exit(-1);
}

const contract_abi = [
  {
    "constant": false,
    "inputs": [
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  },
];

const MIN_CONFIRMS = 10;

const address = argv[0];
const contract_addr = argv[1];

const infuraProvider = new ethers.providers.JsonRpcProvider(AppConfig.INFURA_DEV);
const contract = new ethers.Contract(contract_addr,contract_abi,infuraProvider);
const erc20_interface = new ethers.utils.Interface(contract_abi);

findIncoming();

async function findIncoming() {
  try {
    const balance = parseFloat(formatEther(await contract.balanceOf(address)));
    console.log("balance:",balance);

    const event = erc20_interface.events.Transfer;
    const hash_address = ethers.utils.hexZeroPad(address,32);
    const topics = [event.topic,null,hash_address];
    const filter = {
      fromBlock: 6900000,
      toBlock: "latest",
      address: contract_addr,
      topics,
    };
    const results = await infuraProvider.getLogs(filter);

    results.forEach(async tx => {
      const { transactionHash, } = tx;
      console.log(tx);
      const args = event.decode(tx.data,tx.topics);
      const to_addr = args.to;
      const amount = parseFloat(formatEther(args.value));

      const receipt = await infuraProvider.getTransactionReceipt(transactionHash);
      const loaded_tx = await infuraProvider.getTransaction(transactionHash);
      //console.log("parsed:",erc20_interface.parseTransaction(loaded_tx));
      //console.log("");
      const receipt_addr = receipt.to;
      const { confirmations, status } = receipt;
      const coin_count = Math.floor(amount);

      if (address === to_addr
        && status === 1
        && confirmations >= MIN_CONFIRMS
        && receipt_addr === contract_addr
        && balance > coin_count
        && coin_count > 0) {
        console.log("Good TX: hash:",transactionHash,"coin_count:",coin_count);
      } else {
        console.log("Bad TX: hash:",transactionHash,"coin_count:",coin_count);
      }
      console.log("");

    });
  } catch (e) {
    console.error("threw:",e);
  }

  console.log("done done");
}
