import React, { useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

const PayPalPayment = ({ 
  amount, 
  onSuccess, 
  onError, 
  onCancel, 
  currency = 'PHP' 
}) => {
  // PayPal sandbox client ID - replace with your actual sandbox client ID
  const clientId = 'AZySJalKZ2n2xXKpSNk-Ot5iMz3VWL0xjGsvxFdbTkgbl7JusBOoHMaUZLAIBDgGaFPJaAJRGN_eciRb'; // Get this from https://devel  oper.paypal.com/

  const initialOptions = {
    clientId: clientId,
    currency: currency,
    intent: 'capture',
    'enable-funding': 'venmo',
    'disable-funding': 'paylater,card',
    'data-page-type': 'checkout',
    components: 'buttons',
    'data-partner-attribution-id': 'BN_CODE',
  };

  const createOrder = (data, actions) => {
    return actions.order.create({
      purchase_units: [
        {
          amount: {
            value: amount.toFixed(2),
            currency_code: currency,
          },
          description: 'Food Order Payment',
        },
      ],
    });
  };

  const onApprove = (data, actions) => {
    return actions.order.capture().then((details) => {
      // Payment successful
      const paymentData = {
        orderID: data.orderID,
        payerID: data.payerID,
        paymentID: details.id,
        status: details.status,
        amount: details.purchase_units[0].amount.value,
        currency: details.purchase_units[0].amount.currency_code,
        payer: details.payer,
      };
      
      console.log('Payment successful:', paymentData);
      onSuccess(paymentData);
    });
  };

  const onErrorHandler = (err) => {
    console.error('PayPal payment error:', err);
    onError(err);
  };

  const onCancelHandler = (data) => {
    console.log('PayPal payment cancelled:', data);
    onCancel(data);
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      <PayPalButtons
        createOrder={createOrder}
        onApprove={onApprove}
        onError={onErrorHandler}
        onCancel={onCancelHandler}
        style={{
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal',
        }}
      />
    </PayPalScriptProvider>
  );
};

export default PayPalPayment;