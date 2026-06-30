const { cryptoProviderAdapter } = require('./cryptoProviderAdapter');
const { flutterwaveProviderAdapter } = require('./flutterwaveProviderAdapter');
const { paypalProviderAdapter } = require('./paypalProviderAdapter');
const { paystackProviderAdapter } = require('./paystackProviderAdapter');
const { stripeProviderAdapter } = require('./stripeProviderAdapter');
const { wiseProviderAdapter } = require('./wiseProviderAdapter');

const paymentProviderAdapters = [
  paypalProviderAdapter,
  stripeProviderAdapter,
  wiseProviderAdapter,
  paystackProviderAdapter,
  flutterwaveProviderAdapter,
  cryptoProviderAdapter
];

module.exports = {
  paymentProviderAdapters
};
