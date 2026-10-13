import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import Icons from '../../constants/Icons';
import { downloadInvoicePdfAction, downloadReceiptPdfAction } from '../../redux/action/common/InvoiceAction';
import { downloadPayloadAsPdf } from '../../utils/FileUtils';
import { AppButton } from '../base';

/**
 * Renders the ERP-issued Invoice / Receipt download buttons for a Payment
 * History row. The invoice id and availability flags come straight off the
 * payment row (the payments endpoint attaches the application's latest invoice),
 * so no per-organisation invoice fetch or client-side matching is needed.
 */
const PaymentDocumentsCell = ({ invoiceId, invoicePdfAvailable, receiptPdfAvailable }) => {
  const dispatch = useDispatch();
  const [downloading, setDownloading] = useState(null);

  const handleDownload = useCallback(
    async type => {
      setDownloading(`${invoiceId}-${type}`);
      try {
        const action = type === 'invoice' ? downloadInvoicePdfAction : downloadReceiptPdfAction;
        const result = await dispatch(action(invoiceId));
        if (result.type.endsWith('/fulfilled')) {
          downloadPayloadAsPdf(result.payload, `${type}-${invoiceId}.pdf`);
        }
      } finally {
        setDownloading(null);
      }
    },
    [dispatch, invoiceId],
  );

  if (!invoiceId || (!invoicePdfAvailable && !receiptPdfAvailable)) {
    return <span className="text-3-color">Pending</span>;
  }

  return (
    <div>
      {invoicePdfAvailable && (
        <AppButton variant="link" size="extraSmall" leftIcon={Icons.download} title="Invoice" disabled={downloading === `${invoiceId}-invoice`} onClick={() => handleDownload('invoice')} />
      )}
      {receiptPdfAvailable && (
        <AppButton variant="link" size="extraSmall" leftIcon={Icons.download} title="Receipt" disabled={downloading === `${invoiceId}-receipt`} onClick={() => handleDownload('receipt')} />
      )}
    </div>
  );
};

export default PaymentDocumentsCell;
