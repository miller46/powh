var web3Utility = require('./js/web3utility.js');
var cookieUtility = require('./js/cookieUtility.js');
var config = require('./js/config.js');

var web3 = web3Utility.initWeb3(window.web3);
var powhContract;
var usdPrice;
var tokenPrice;

var address = getSavedAddress();
if (address) {
    $('#balance_address').val(address);
} else {
    var account = web3.eth.accounts[0]
    if (account) {
        $('#balance_address').val(account);
    }
}

function getSavedAddress() {
    var userCookie = cookieUtility.readCookie(config.userCookie);
    if (userCookie) {
        userCookie = JSON.parse(userCookie);
        return userCookie["address"];
    }

    return false;
}

web3Utility.loadContract(web3, config.contractFileNameBase, config.contractAddress, function(err, contract) {
    if (err) {
        console.log(err);
    } else {
        powhContract = contract;

        loadData();

        setInterval(loadData, 3000);

        watchForLatestTransactions();
    }
});


function watchForLatestTransactions() {
    web3.eth.getBlockNumber(function(err, result) {
        if (err) {
            console.log(err);
        } else {
            var blockNumber = result;
            var options = {
                fromBlock: blockNumber - 25,
                address: config.contractAddress,
            };
            var filter = web3.eth.filter(options);
            filter.watch(function(err, result) {
                if (err) {
                    console.log(err);
                } else {
                    console.log(result);
                    var blockHash = result.blockHash;
                    web3.eth.getBlock(blockHash, true, function(err, result) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log(result);
                            var txs = result.transactions;
                            for (var i = 0; i < txs.length; i++) {
                                var tx = txs[i];
                                tx.timestamp = result.timestamp;
                                addTxToTableIfNecessary(tx);
                            }
                        }
                    });
                }
            });
        }
    });
}

function addTxToTableIfNecessary(tx) {
    if (tx.to && tx.to.toLowerCase() === config.contractAddress.toLowerCase()) {
        var now = Math.round(new Date().getTime() / 1000);
        var timestamp = tx.timestamp;
        var timeAgo = "";
        var diff = now - timestamp;
        if (diff < 60) {
            timeAgo = diff.toFixed(0) + " seconds ago";
        } else if (diff < 3600) {
            timeAgo = (diff / 60).toFixed(0) + " minutes ago";
        } else {
            timeAgo = (diff / 3600).toFixed(0) + " hours ago";
        }
        var userLink = "<a target='_blank' href='https://etherscan.io/address/" + tx.from + "'>" + tx.from + "</a>";
        var input = tx.input;
        var action = "<td>Internal Tx</td>";
        if (tx.value.toNumber() > 0) {
            action = "<td class='profit'>BUY</td>";
        } else {
            action = "<td class='loss'>WEAK HANDS</td>";
        }
        var amount = web3Utility.weiToEth(tx.value.toNumber(), undefined, 4);

        $('#tx_table tbody tr:first').before('<tr><td>' + timeAgo + '</td><td>' + userLink + '</td>' + action + '<td>' + amount + ' ETH</td></tr>');
    }
}

function loadData() {
    web3Utility.getPriceUsd(function(err, price) {
        if (err) {
            console.log(err);
        } else {
            usdPrice = price;
            $('.usdPrice').show();

            var address = getSavedAddress();
            if (address) {
                lookupAddress(address);
            } else if (web3.eth.defaultAccount) {
                lookupAddress(web3.eth.defaultAccount);
            }

            web3Utility.call(web3, powhContract, config.contractAddress, 'buyPrice', {}, function (err, result) {
                if (err) {
                    console.log(err);
                } else {
                    tokenPrice = 1/(web3Utility.weiToEth(result.toNumber(), undefined, 10) * 0.9)/1000000;

                    setClassNameForPriceField("buyPrice", tokenPrice);

                    $('#buyPrice').text(tokenPrice.toFixed(6));
                    $('#buyPriceUsd').text("$" + toDollars(tokenPrice * usdPrice));
                }
            });

            web3.eth.getBalance(config.contractAddress, function (err, result) {
                if (err) {
                    console.log(err);
                } else {
                    var total = web3Utility.weiToEth(result.toNumber(), undefined, 4);
                    $('#totalEth').text(total);
                    $('#totalEthUsd').text("$" + toDollars(total * usdPrice));
                }
            });

            showScreen();
        }
    });
}

function setClassNameForPriceField(name, newPrice) {
    var field = $('#' + name);
    var fieldUsd = $('#' + name + "Usd");
    var className = "normal";
    var lastPrice = field.text();
    if (lastPrice) {
        lastPrice = parseFloat(lastPrice);
        if (lastPrice - newPrice > 0.0001) {
            className = "loss";
        } else if (newPrice - newPrice > 0.0001) {
            className = "profit";
        }
    }

    field.parent().addClass(className);
}

$('#lookup').click(function() {
    var address = $('#balance_address').val();
    if (!address) {
        // TODO show error
    } else {
        lookupAddress(address);
    }
});

function lookupAddress(address) {
    var data = {
        "address": address
    };
    cookieUtility.createCookie(config.userCookie, JSON.stringify(data), 999);

    $('#user_address').text(address);
    web3Utility.call(web3, powhContract, config.contractAddress, 'balanceOf', [address], function (err, result) {
        if (err) {
            console.log(err);
        } else {
            var balance = result.toNumber() / Math.pow(10, 15);
            $('#balanceEth').text(balance.toFixed(4));
            $('#balanceUsd').text("$" + toDollars(balance * tokenPrice * usdPrice));

            web3Utility.call(web3, powhContract, config.contractAddress, 'sellPrice', {}, function (err, result) {
                if (err) {
                    console.log(err);
                } else {
                    var sellPrice = result.toNumber() / Math.pow(10, 18);
                    var shareWorth = balance * sellPrice;

                    setClassNameForPriceField("shareWorth", shareWorth);

                    $('#shareWorth').text(shareWorth.toFixed(6));
                    $('#shareWorthUsd').text("$" + toDollars(shareWorth * usdPrice));
                }
            });

            $('#values').show();
        }
    });

    web3Utility.call(web3, powhContract, config.contractAddress, 'dividends', [address], function (err, result) {
        if (err) {
            console.log(err);
        } else {
            var dividends = web3Utility.weiToEth(result.toNumber(), undefined, 6);
            $('#dividendEth').text(dividends);
            $('#dividendUsd').text("$" + toDollars(dividends * usdPrice));

            $('#values').show();
        }
    });
}


$('#sell').click(function() {
    var address = $('#dividend_address').val();
    web3Utility.call(web3, powhContract, config.contractAddress, 'getMeOutOfHere', {}, function (err, result) {
        if (err) {
            console.log(err);
        } else {
            console.log(result);
        }
    });
});

function toDollars(num) {
    return ("" + num.toFixed(2)).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
}

function getEtherForTokens(tokens, callback) {
    web3Utility.call(web3, powhContract, config.contractAddress, 'getEtherForTokens', [tokens], function (err, result) {
        if (err) {
            callback(err, undefined);
        } else {
            callback(undefined, result.toNumber());
        }
    });
}

function showScreen() {

}


