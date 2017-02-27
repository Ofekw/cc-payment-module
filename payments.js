(function (window) {
    'use strict';
    /**
     * Simple object to encapsulate functionality related calling the REST API
     */
    function AjaxHelper() { }
    /**
     * Tokenises card data and returns token to callback function passed in
     * @param {Object} data.                 Model Schema: {
     *                                                       number: "String",
     *                                                       cvd: "String",
     *                                                       expiry_month: "String - MM",
     *                                                       expiry_year: "String - YYYY" }
     *
     * @param {Function} callback.  Model Schema: {
     *                                                       "token": "string",
     *                                                       "code": "string",
     *                                                       "version": 0,
     *                                                       "message": "string" }
     */
    AjaxHelper.prototype = {
        getToken: function (data, callback) {
            var self = this;
            var url = ''; //TODO GET API base
            data = JSON.stringify(data);
            if (window.XMLHttpRequest) {
                var xhttp = new XMLHttpRequest();
                xhttp.onreadystatechange = function () {
                    if (xhttp.readyState === 4 && xhttp.status === 200) {
                        callback(self.parseResponse(xhttp.responseText));
                    }
                }.bind(self);
                xhttp.ontimeout = function (e) {
                    console.log('Error: tokenisation request timed out');
                    var response = new self.formattedResponse();
                    response.code = 0;
                    response.message = 'Timeout';
                    callback(response);
                }.bind(self);
                xhttp.open('POST', url, true);
                // header required for ios safari support: http://stackoverflow.com/a/30296149
                xhttp.setRequestHeader("Content-Type", "text/plain");
                xhttp.timeout = 10000;
                xhttp.send(data);
            } else if (window.XDomainRequest) {
                // https required for POST CORS requests in XDomainRequest
                // XDomainRequest required to support  IE 8 and 9
                // https://developer.mozilla.org/en-US/docs/Web/API/XDomainRequest
                // https required for POST CORS requests in XDomainRequest
                if (window.location.protocol === 'https:') {
                    var xdr = new XDomainRequest();
                    xdr.open('get', url);
                    xdr.onload = function () {
                        callback(self.parseResponse(xdr.responseText));
                    };
                    setTimeout(function () {
                        xdr.send(data);
                    }, 0);
                } else {
                    var response = new self.formattedResponse();
                    response.code = 5;
                    response.message = 'HTTPS connection required in Internet Explorer 9 and below';
                    callback(response);
                }
            } else {
                var response = new self.formattedResponse();
                response.code = 6;
                response.message = 'Unsupported browser';
                callback(response);
            }
        },
        formattedResponse: function () {
            var self = this;
            self.code = '';
            self.message = '';
            self.token = '';
            self.success = false;
        },
        parseResponse: function (obj) {
            var self = this;
            obj = JSON.parse(obj);
            var response = new self.formattedResponse();
            if (obj.code === 1) {
                response.success = true;
                response.token = obj.token;
            }
            response.code = obj.code;
            response.message = obj.message;
            response.token = obj.token;
            return response;
        }
    };
    // Export to window
    window.AjaxHelper = AjaxHelper;
})(window);

(function (window) {
    'use strict';

    var Validator = (function () {
        var defaultFormat = /(\d{1,4})/g;
        var cards = [{
            type: 'visaelectron',
            patterns: [4026, 417500, 4405, 4508, 4844, 4913, 4917],
            format: defaultFormat,
            length: [16],
            cvcLength: [3],
            luhn: true
        }, {
            type: 'maestro',
            patterns: [5018, 502, 503, 56, 58, 639, 6220, 67],
            format: defaultFormat,
            length: [12, 13, 14, 15, 16, 17, 18, 19],
            cvcLength: [3],
            luhn: true
        }, {
            type: 'visa',
            patterns: [4],
            format: defaultFormat,
            length: [13, 16],
            cvcLength: [3],
            luhn: true
        }, {
            type: 'mastercard',
            patterns: [51, 52, 53, 54, 55, 22, 23, 24, 25, 26, 27],
            format: defaultFormat,
            length: [16],
            cvcLength: [3],
            luhn: true
        }, {
            type: 'amex',
            patterns: [34, 37],
            format: /(\d{1,4})(\d{1,6})?(\d{1,5})?/,
            length: [15],
            cvcLength: [3, 4],
            luhn: true
        }, {
            type: 'dinersclub',
            patterns: [30, 36, 38, 39],
            format: /(\d{1,4})(\d{1,6})?(\d{1,4})?/,
            length: [14],
            cvcLength: [3],
            luhn: true
        }, {
            type: 'discover',
            patterns: [60, 64, 65, 622],
            format: defaultFormat,
            length: [16],
            cvcLength: [3],
            luhn: true
        }, {
            type: 'jcb',
            patterns: [35],
            format: defaultFormat,
            length: [16],
            cvcLength: [3],
            luhn: true
        }];

        function getLuhnChecksum(numStr) {
            numStr = numStr.replace(/\s+/g, '');
            var digit;
            var sum = 0;
            var numArray = numStr.split('').reverse();

            for (var i = 0; i < numArray.length; i++) {
                digit = numArray[i];
                digit = +digit;

                if (i % 2) {
                    digit *= 2;

                    if (digit < 10) {
                        sum += digit;
                    } else {
                        sum += digit - 9;
                    }
                } else {
                    sum += digit;
                }
            }

            return sum % 10 === 0;
        }

        function formatCardNumber(str) {
            str = str.replace(/\D/g, '');
            var cardType = getCardType(str);

            var card = cards.filter(function (c) {
                return c.type === cardType;
            });

            card = card[0];

            if (card) {
                var format = card.format;

                if (format.global) {
                    var arr = str.match(format).join(' ');
                    str = limitLength(arr, 'length', cardType);
                } else {
                    var arr = format.exec(str);
                    arr.shift();// remove first element which contains the full matched text
                    str = arr.join(' ');
                    str = str.trim();// remove whitespaces seperating empty arrays - all patterns not yet matched
                }
            }

            return str;
        }

        function formatExpiry(str) {
            var parts = str.match(/^\D*(\d{1,2})(\D+)?(\d{1,4})?/);

            if (!parts) {
                return '';
            }

            var mon = parts[1] || '';
            var sep = parts[2] || '';
            var year = parts[3] || '';

            if (year.length > 0) {
                sep = ' / ';
            } else if (sep === ' /') {
                mon = mon.substring(0, 1);
                sep = '';
            } else if (mon.length === 2 && (parseInt(mon) > 12)) {
                mon = '1';
            } else if (mon.length === 2 || sep.length > 0) {
                sep = ' / ';
            } else if (mon.length === 1 && (mon !== '0' && mon !== '1')) {
                mon = '0' + mon;
                sep = ' / ';
            }

            return mon + sep + year;
        }

        function limitLength(str, fieldType, cardType) {
            if ((fieldType !== 'length' && fieldType !== 'cvcLength') || cardType === undefined || cardType === '') {
                return str;
            }

            var max = getMaxLength(fieldType, cardType);

            // adjust for whitespacing in creditcard str
            var whiteSpacing = (str.match(new RegExp(' ', 'g')) || []).length;

            // trim() is needed to remove final white space
            str = str.substring(0, max + whiteSpacing).trim();

            return str;
        }

        function getMaxLength(fieldType, cardType) {
            var card = cards.filter(function (c) {
                return c.type === cardType;
            });
            card = card[0];

            var lengths = card[fieldType];
            var max = Math.max.apply(Math, lengths);
            return max;
        }

        function isValidExpiryDate(str, currentDate, onBlur) {

            currentDate.setDate(0);

            var arr = str.split('/');
            var month = arr[0];
            if (month) {
                // JavaScript counts months from 0 to 11
                month = month.trim() - 1;
            }

            var year = arr[1];
            if (year) {
                year = year.trim();
            }

            if (onBlur) {
                if (str === '') {
                    // Validate onBlur as required field
                    return { isValid: false, error: 'Please enter an expiry date.', fieldType: 'expiry' };
                } else if (!year || year.length != 4) {
                    return { isValid: false, error: 'Please enter a valid expiry date.', fieldType: 'expiry' };
                } else if (new Date(year, month) < currentDate) {
                    return {
                        isValid: false, error: 'Please enter a valid expiry date. The date entered is past.',
                        fieldType: 'expiry'
                    };
                } else {
                    // valid
                    return { isValid: true, error: '', fieldType: 'expiry' };
                }
            } else {
                if (year && year.length === 4 && new Date(year, month) < currentDate) {
                    return {
                        isValid: false, error: 'Please enter a valid expiry date. The date entered is past.',
                        fieldType: 'expiry'
                    };
                } else {
                    // valid
                    return { isValid: true, error: '', fieldType: 'expiry' };
                }
            }

        }

        function getCardType(str) {
            var cardType = '';

            loop1:

            for (var i = 0; i < cards.length; i++) {
                var patterns = cards[i].patterns;
                loop2:

                for (var j = 0; j < patterns.length; j++) {
                    var pos = str.indexOf(patterns[j]);

                    if (pos === 0) {
                        cardType = cards[i].type;
                        break loop1;
                    }
                }
            }

            return cardType;
        }

        function isValidCardNumber(str, onBlur) {
            str = str.replace(/\s+/g, '');
            var cardType = '';
            var max = 0;

            if (str.length > 0) {
                cardType = getCardType(str);

                if (cardType) {
                    max = getMaxLength('length', cardType);
                }
            }

            if (onBlur) {
                if (str.length === 0) {
                    // Validate onBlur as required field
                    return { isValid: false, error: 'Please enter a credit card number.', fieldType: 'number' };
                } else if (cardType === '') {
                    return { isValid: false, error: 'Please enter a valid credit card number.', fieldType: 'number' };
                } else if (str.length < max) {
                    // if onBlur and str not complete
                    return {
                        isValid: false,
                        error: 'Please enter a valid credit card number. The number entered is too short.',
                        fieldType: 'number'
                    };
                } else {
                    var luhn = getLuhnChecksum(str);

                    if (luhn) {
                        return { isValid: true, error: '', fieldType: 'number' };
                    } else {
                        return { isValid: false, error: 'Please enter a valid credit card number.', fieldType: 'number' };
                    }
                }

            } else {
                if (str.length === max && max !== 0) {
                    var luhn = getLuhnChecksum(str);

                    if (luhn) {
                        return { isValid: true, error: '', fieldType: 'number' };
                    } else {
                        return { isValid: false, error: 'Please enter a valid credit card number.', fieldType: 'number' };
                    }
                }

            }

            return { isValid: true, error: '', fieldType: 'number' };// Report valid while user is inputting str
        }

        function isValidCvc(cardType, str, onBlur) {
            if (onBlur && str.length === 0) {
                return { isValid: false, error: 'Please enter a CVV number.', fieldType: 'cvv' };
            }

            if (cardType === '') {
                return { isValid: true, error: '', fieldType: 'cvv' }; // Unknown card type. Default to true
            }

            var max = getMaxLength('cvcLength', cardType);

            if (str.length < max && onBlur === true) {
                return {
                    isValid: false,
                    error: 'Please enter a valid CVV number. The number entered is too short.',
                    fieldType: 'cvv'
                };
            }

            if (str.length > max && onBlur === true) {
                return {
                    isValid: false,
                    error: 'Please enter a valid CVV number. The number entered is too long.',
                    fieldType: 'cvv'
                };
            }

            return { isValid: true, error: '', fieldType: 'cvv' };
        }

        return {
            getCardType: getCardType,
            getLuhnChecksum: getLuhnChecksum,
            formatCardNumber: formatCardNumber,
            formatExpiry: formatExpiry,
            limitLength: limitLength,
            isValidExpiryDate: isValidExpiryDate,
            isValidCardNumber: isValidCardNumber,
            isValidCvc: isValidCvc,
            getMaxLength: getMaxLength
        };
    })();

    // Export to window
    window.Validator = Validator;
})(window);

(function (window) {
    'use strict';
    var PaymentModule = (function () {

        var containerId,
            apiCredentials,
            requestCallback;
        
        // HTML to be injected
        var paymentHTML = (function () {/*
<figure class="ext_payment_library">
  <div class="paymentInfo">
  </div>

  <form class="cardInfo"  id="cc-payment-form" action="" method="post">

    <fieldset class="cardInfo-cardDetails">

      <div class="form-row cardInfo-cc-num">
        <label for="cc-num">
          <abbr title="required">*</abbr>
          <span>Card Number</span>
        </label>
        <input id="cc-num" type="tel" class="paymentInput cc-num" placeholder="•••• •••• •••• ••••" autocompletetype="cc-number" required="required">
      </div>

      <div class="form-row cardInfo-cc-exp">
        <label for="cc-exp">
          <abbr title="required">*</abbr>
          <span>Expires</span>
        </label>
        <input id="cc-exp" type="tel" class="paymentInput cc-exp cc-exp__demo" placeholder="MM / YYYY" autocompletetype="cc-exp" required="required">
      </div>

      <div class="form-row cardInfo-cc-cvc">
        <label for="cc-cvc">
          <abbr title="required">*</abbr>
          <span>CVC</span>
        </label>
        <input id="cc-cvc" type="tel" class="paymentInput cc-cvc cc-cvc__demo" placeholder="CVC" autocompletetype="cc-cvc" required="required" maxlength="4">
      </div>

      <div class="cardInfo-submission">
        <input class="button" name="commit" type="submit" id="card-submit" value="Make Payment">
      </div>
    </fieldset>
  </form>
</figure>
<figre id=container>
</figre>       
*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

        /**
         * Initialises the PaymentModule
         * @param {Element} container is the id of the element where the the the payment form will be injected into. 
         * @param {String} sessionKey is the one time sesssion token retrieved from the backend. 
         * @param {Styles} styles is the object containing styling properties for the payment elements //TODO add details of object schema
         * @param {String} requestCallback is the callback that will be called when card details are submitted.
         *                                   @callback requestCallback~onSuccess
         *                                           @param {string} code
         *                                           @param {string} message
         *                                           @param {string} token
         *                                   @callback requestCallback~onFailure
         *                                           @param {string} code
         *                                           @param {string} message
         */
        function initialise(container, sessionKey, requestCallback) {
            this.container = container;
            this.sessionKey = sessionKey;
            this.requestCallback = requestCallback;

            if (this.container == null) {
                console.error('payment form container id is invalid, call PaymentForm.Initialise(container, sessionKey, requestCallback)');
                return;
            }

            /**
             * Initialise DOM
             */

            container.innerHTML = paymentHTML;
            var creditCardInput = document.getElementById('cc-num');
            var creditCardExp = document.getElementById('cc-exp');
            var creditCardCVC = document.getElementById('cc-cvc');
            var form = document.getElementById('cc-payment-form');

            // TODO: Dynamic styling

            /**
             * Event Handlers
             */

            // CC NUMBER HANDLER
            var creditCardInputHandler = function () {
                creditCardInput.value = Validator.formatCardNumber(creditCardInput.value);

                //Reset validity
                creditCardInput.setCustomValidity('');

                var ccNumberVal = Validator.isValidCardNumber(creditCardInput.value, true);
                if (!ccNumberVal.isValid) {
                    creditCardInput.setCustomValidity(ccNumberVal.error);
                }
            };

            addListenerMulti(creditCardInput, 'input change keypress paste', creditCardInputHandler);
            //END CC NUMBER HANDLER

            // EXPIRY DATE HANDLER
            var creditCardExpHandler = function () {
                creditCardExp.value = Validator.formatExpiry(creditCardExp.value);

                //Reset validity
                creditCardExp.setCustomValidity('');

                var ccExpVal = Validator.isValidExpiryDate(creditCardExp.value, new Date(), true);
                if (!ccExpVal.isValid) {
                    creditCardExp.setCustomValidity(ccExpVal.error);
                }
            };

            addListenerMulti(creditCardExp, 'input change keypress paste', creditCardExpHandler);
            // END EXPIRY DATE HANDLER

            // CVC HANDLER
            var creditCardCVCHandler = function () {

                //Reset validity
                creditCardCVC.setCustomValidity('');

                var ccCVCVal = Validator.isValidCvc(Validator.getCardType(creditCardInput.value), creditCardCVC.value, true);
                if (!ccCVCVal.isValid) {
                    creditCardCVC.setCustomValidity(ccCVCVal.error);
                }
            };

             addListenerMulti(creditCardCVC, 'input change keypress paste', creditCardCVCHandler);
            // END CVC HANDLER

            // FORM SUBMIT HANDLER
            form.addEventListener('submit', function (e) {
                submit(e, this.callback);
                e.preventDefault();    //stop form from submitting
            }.bind(this), false);
            //END FORM SUBMIT HANDLER

            var submit = function (e, callback) {
                if (e.currentTarget.checkValidity() == true) { //Is valid check here
                    //api call which also calls requestCallback
                }
            };

            /* Add one or more listeners to an element
            ** @param {DOMElement} element - DOM element to add listeners to
            ** @param {string} eventNames - space separated list of event names, e.g. 'click change'
            ** @param {Function} listener - function to attach for each event as a listener
            */
            function addListenerMulti(element, eventNames, listener) {
                var events = eventNames.split(' ');
                for (var i = 0, iLen = events.length; i < iLen; i++) {
                    element.addEventListener(events[i], listener.bind(this), false);
                }
            }
        }

        // TODO: Form controls, reset, clear etc

        // TODO: Callback handler

        return {
            initialise: initialise
        };
    })();

    window.PaymentModule = PaymentModule;
})(window);
