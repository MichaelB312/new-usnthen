import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(request: NextRequest) {
  try {
    const { bookId, bookData, customerInfo } = await request.json();
    
    // Calculate pricing
    const basePrice = 2499; // $24.99
    const perPagePrice = 199; // $1.99 per page over 8
    const extraPages = Math.max(0, bookData.pages.length - 8);
    const subtotal = basePrice + (extraPages * perPagePrice);
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: bookData.title,
              description: `Personalized storybook for ${bookData.babyName}`,
              images: [bookData.coverImage],
            },
            unit_amount: basePrice,
          },
          quantity: 1,
        },
        ...(extraPages > 0 ? [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Additional Pages',
              description: `${extraPages} extra pages`,
            },
            unit_amount: perPagePrice,
          },
          quantity: extraPages,
        }] : []),
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/order/cancel`,
      metadata: {
        bookId,
        customerEmail: customerInfo.email,
      },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 499,
              currency: 'usd',
            },
            display_name: 'Standard Shipping',
            delivery_estimate: {
              minimum: {
                unit: 'business_day',
                value: 5,
              },
              maximum: {
                unit: 'business_day',
                value: 10,
              },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 999,
              currency: 'usd',
            },
            display_name: 'Express Shipping',
            delivery_estimate: {
              minimum: {
                unit: 'business_day',
                value: 2,
              },
              maximum: {
                unit: 'business_day',
                value: 3,
              },
            },
          },
        },
      ],
      automatic_tax: {
        enabled: true,
      },
    });
    
    return NextResponse.json({ 
      success: true, 
      sessionId: session.id,
      url: session.url 
    });
    
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}