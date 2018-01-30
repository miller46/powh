var Web3 = require('web3');
var config = (typeof(global.config) == 'undefined' && typeof(config) == 'undefined') ? require('../js/config.js') : global.config;
var fs = require('fs');
var request = require('request');
var FileReader = require('filereader')
var SolidityFunction = require('web3/lib/web3/function.js');

function initWeb3(web3) {
    if (typeof web3 !== 'undefined' && typeof Web3 !== 'undefined') {
        //is MetaMask
        web3 = new Web3(web3.currentProvider);
    } else if (typeof Web3 !== 'undefined' && window.location.protocol !== "https:") {
        //is Ethereum Client (e.g. Mist)
        web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
    } else if (config.defaultWeb3Provider) {
        web3 = new Web3(new Web3.providers.HttpProvider(config.defaultWeb3Provider));
    } else {
        //no web3 provider
        web3 = new Web3();
    }

    return web3;
}

function weiToEth(wei, divisor, decimal) {
    if (!divisor) divisor = 1000000000000000000;
    if (!decimal) decimal = 3;
    return (wei/divisor).toFixed(decimal);
}

function ethToWei(eth, divisor, precision) {
    if (!divisor) divisor = 1000000000000000000;
    if (!precision) precision = 10;
    return parseFloat((eth*divisor).toPrecision(precision));
}

function roundToNearest(numToRound, numToRoundTo) {
    numToRoundTo = 1 / (numToRoundTo);
    return Math.round(numToRound * numToRoundTo) / numToRoundTo;
}

function getURL(url, options, callback) {
    request.get(url, options, function(err, httpResponse, body){
        if (err) {
            callback(err, undefined);
        } else {
            callback(undefined, body);
        }
    });
}

function postURL(url, headers, formData, callback) {
    var options = {
        url: url,
        form: formData,
        headers: headers
    };
    request.post(options, function(err, httpResponse, body) {
        if (err) {
            callback(err, undefined);
        } else {
            callback(undefined, body);
        }
    });
}

function putURL(url, headers, formData, callback) {
    var options = {
        url: url,
        form: formData,
        headers: headers
    };
    request.put(options, function(err, httpResponse, body) {
        if (err) {
            callback(err, undefined);
        } else {
            callback(undefined, body);
        }
    });
}

function readFile(file, callback) {
    fetch(file)
        .then(function(response){
            return response.text()
        })
        .then(function (text) {
            callback(undefined, text);
        });
}

function getPriceUsd(callback) {
    var url = "https://api.coinmarketcap.com/v1/ticker/ethereum/";
    getURL(url, null, function(err, body) {
        if (!err) {
            result = JSON.parse(body);
            callback(undefined, result[0]['price_usd']);
        } else {
            callback(err, undefined);
        }
    });
}

function loadContract(web3, sourceCode, address, callback) {
    readFile(sourceCode + '.abi', function(error, abi){
        try {
            abi = JSON.parse(abi);
            var instance = web3.eth.contract(abi);
            var contract = instance.at(address);
            callback(undefined, contract);
        } catch(e) {
            callback(e, undefined);
        }
    });
}

function getBalance(web3, address, callback) {
    try {
        if (web3.currentProvider) {
            web3.eth.getBalance(address, function(err, balance){
                if (!err) {
                    callback(undefined, balance);
                } else {
                    proxy();
                }
            });
        } else {
            proxy();
        }
    } catch(err) {
        proxy();
    }
}

function send(web3, contract, address, functionName, args, fromAddress, nonce, gasPrice, callback) {
    function encodeConstructorParams(abi, params) {
        return abi.filter(function (json) {
            return json.type === 'constructor' && json.inputs.length === params.length;
        }).map(function (json) {
            return json.inputs.map(function (input) {
                return input.type;
            });
        }).map(function (types) {
            return coder.encodeParams(types, params);
        })[0] || '';
    }
    args = Array.prototype.slice.call(args).filter(function (a) {return a !== undefined; });
    var options = {};
    if (typeof(args[args.length-1]) === 'object' && args[args.length-1].gas !== undefined) {
        args[args.length - 1].gasPrice = gasPrice;
        args[args.length - 1].gasLimit = args[args.length - 1].gas;
        delete args[args.length - 1].gas;
    }
    if (utils.isObject(args[args.length - 1])) {
        options = args.pop();
    }
    getNextNonce(web3, fromAddress, function(err, nextNonce){
        if (nonce === undefined || nonce < nextNonce) {
            nonce = nextNonce;
        }

        options.nonce = nonce;
        if (functionName === "constructor") {
            if (options.data.slice(0,2) !== "0x") {
                options.data = '0x' + options.data;
            }
            var encodedParams = encodeConstructorParams(contract.abi, args);
            console.log(encodedParams);
            options.data += encodedParams;
        } else if (contract === undefined || functionName === undefined) {
            options.to = address;
        } else {
            options.to = address;
            var functionAbi = contract.abi.find(function(element, index, array) {return element.name ===functionName});
            var inputTypes = functionAbi.inputs.map(function(x) {return x.type});
            var typeName = inputTypes.join();
            options.data = '0x' + sha3(functionName+'('+typeName+')').slice(0, 8) + coder.encodeParams(inputTypes, args);
        }

        try {
            if (web3.currentProvider) {
                options.from = fromAddress;
                options.gas = options.gasLimit;
                delete options.gasLimit;
                web3.eth.sendTransaction(options, function(err, hash) {
                    if (!err) {
                        callback(undefined, {txHash: hash, nonce: nonce + 1});
                    } else {
                        callback(err, undefined);
                    }
                })
            } else {
                callback("No web3", undefined);
            }
        } catch (err) {
            callback(err, undefined);
        }
    });
}

function call(web3, contract, address, functionName, args, callback) {
    try {
        if (web3.currentProvider) {
            var data = contract[functionName].getData.apply(null, args);
            web3.eth.call({to: address, data: data}, function(err, result){
                if (err) {
                    callback(err, undefined);
                } else {
                    var functionAbi = contract.abi.find(function(element, index, array) {return element.name === functionName});
                    var solidityFunction = new SolidityFunction(web3.Eth, functionAbi, address);
                    try {
                        result = solidityFunction.unpackOutput(result);
                        callback(undefined, result);
                    } catch (err) {
                        callback(err, undefined);
                    }
                }
            });
        } else {
            callback("No web3", undefined);
        }
    } catch(err) {
        callback(err, undefined);
    }
}

function getNextNonce(web3, address, callback) {
    try {
        if (web3.currentProvider) {
            web3.eth.getTransactionCount(address, function(err, result){
                if (!err) {
                    var nextNonce = Number(result);
                    //Note. initial nonce is 2^20 on testnet, but getTransactionCount already starts at 2^20.
                    callback(undefined, nextNonce);
                } else {
                    callback(err, undefined);
                }
            });
        } else {
            callback("No web3", undefined);
        }
    } catch(err) {
        callback(err, undefined);
    }
}

exports.initWeb3 = initWeb3;
exports.getNextNonce = getNextNonce;
exports.call = call;
exports.weiToEth = weiToEth;
exports.ethToWei = ethToWei;
exports.roundToNearest = roundToNearest;
exports.getBalance = getBalance;
exports.loadContract = loadContract;
exports.getURL = getURL;
exports.postURL = postURL;
exports.putURL = putURL;
exports.getPriceUsd = getPriceUsd;