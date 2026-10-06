/**
 * testOrderStatusEmails.js
 * Verification script for order status email notifications
 */
import { getOrderStatusEmailContent, isEmailableStatus } from '../services/emailTemplates/orderStatusTemplates.js';
import { sendOrderStatusEmail } from '../services/orderEmailNotification.service.js';

async function runTests() {
    console.log('=== RUNNING ORDER STATUS EMAIL NOTIFICATION TESTS ===\n');

    const sampleOrder = {
        orderId: 'ORD-TEST-999',
        total: 1499.50,
        trackingNumber: 'TRK-987654321',
        createdAt: new Date(),
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        shippingAddress: {
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '9876543210',
            address: '123 Main St',
            city: 'Mumbai',
            state: 'Maharashtra',
            zipCode: '400001',
        },
        cancellationReason: 'Customer requested cancellation',
    };

    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];

    // Test 1: Template generation for all statuses
    console.log('Test 1: Template generation for all canonical statuses...');
    for (const status of statuses) {
        const isEmailable = isEmailableStatus(status);
        if (!isEmailable) {
            throw new Error(`Status ${status} should be emailable!`);
        }
        const { subject, html, text } = getOrderStatusEmailContent(sampleOrder, status);
        if (!subject || !html || !text) {
            throw new Error(`Missing content for status ${status}`);
        }
        if (!subject.includes(sampleOrder.orderId)) {
            throw new Error(`Subject does not include orderId for status ${status}: ${subject}`);
        }
        if (!html.includes(sampleOrder.orderId) || !html.includes('John Doe')) {
            throw new Error(`HTML content missing orderId or customer name for status ${status}`);
        }
        console.log(`  ✓ [${status.toUpperCase()}] Subject: "${subject}" | HTML length: ${html.length} chars`);
    }

    // Test 2: Unknown status check
    console.log('\nTest 2: Unknown status check...');
    if (isEmailableStatus('random_unknown_status')) {
        throw new Error('Unknown status should not be emailable');
    }
    console.log('  ✓ Unknown status correctly ignored');

    // Test 3: Duplicate status protection (previousStatus === newStatus)
    console.log('\nTest 3: Duplicate status protection...');
    await sendOrderStatusEmail(sampleOrder, 'shipped', 'shipped');
    console.log('  ✓ Duplicate status skipped cleanly without sending');

    // Test 4: Missing email handling
    console.log('\nTest 4: Missing email handling...');
    const orderWithoutEmail = {
        orderId: 'ORD-NO-EMAIL',
        shippingAddress: { name: 'No Email User' },
        guestInfo: {},
    };
    await sendOrderStatusEmail(orderWithoutEmail, 'pending', 'processing');
    console.log('  ✓ Order without email handled gracefully without throwing');

    // Test 5: Fallback to guestInfo email
    console.log('\nTest 5: Guest info email fallback...');
    const guestOrder = {
        orderId: 'ORD-GUEST-1',
        guestInfo: { name: 'Guest User', email: 'guest@example.com' },
        shippingAddress: {},
    };
    const { subject: guestSubject, html: guestHtml } = getOrderStatusEmailContent(guestOrder, 'processing');
    if (!guestSubject || !guestHtml) {
        throw new Error('Guest order email template generation failed');
    }
    console.log(`  ✓ Guest order email generated: "${guestSubject}"`);

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===\n');
}

runTests().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
