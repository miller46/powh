var web3Utility = require('./js/web3utility.js');
var cookieUtility = require('./js/cookieUtility.js');
var config = require('./js/config.js');

var web3 = web3Utility.initWeb3(window.web3);
var powhContract;
var usdPrice;
var tokenPrice;

var userCookie = cookieUtility.readCookie(config.userCookie);
if (userCookie) {
    userCookie = JSON.parse(userCookie);
    $('#balance_address').val(userCookie["address"]);
}

web3Utility.loadContract(web3, config.contractFileNameBase, config.contractAddress, function(err, contract) {
    if (err) {
        console.log(err);
    } else {
        powhContract = contract;

        loadData();

        setInterval(loadData, 3000);
    }
});

function loadData() {
    web3Utility.getPriceUsd(function(err, price) {
        if (err) {
            console.log(err);
        } else {
            usdPrice = price;
            $('.usdPrice').show();

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
        if (lastPrice - newPrice > 0.001) {
            className = "loss";
        } else if (newPrice - newPrice > 0.001) {
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
        var data = {
            "address": address
        };
        cookieUtility.createCookie(config.userCookie, JSON.stringify(data), 999);

        $('#user_address').text(address);
        web3Utility.call(web3, powhContract, config.contractAddress, 'balanceOf', [address], function (err, result) {
            if (err) {
                console.log(err);
            } else {
                var balance = web3Utility.weiToEth(result.toNumber(), 1000000000000000, 4);
                $('#balanceEth').text(balance);
                $('#balanceUsd').text("$" + toDollars(balance * tokenPrice * usdPrice));

                $('#values').show();
            }
        });
    }

    web3Utility.call(web3, powhContract, config.contractAddress, 'dividends', [address], function (err, result) {
        if (err) {
            console.log(err);
        } else {
            var dividends = web3Utility.weiToEth(result.toNumber());
            $('#dividendEth').text(dividends);
            $('#dividendUsd').text("$" + toDollars(dividends * usdPrice));

            $('#values').show();
        }
    });
});


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


