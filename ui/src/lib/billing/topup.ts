// Self-serve credit top-up seam. The real implementation (create a Razorpay
// order on the backend + open Razorpay checkout) lands on this branch as a
// separate concurrent task. Until then the seam throws so the UI can surface a
// friendly "not wired yet" message without any placeholder charge flow.

import { resolveBrowserBackendUrl } from "@/lib/apiClient";

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** Starts a self-serve top-up for `amountUsd`. Implemented by the Razorpay integration. */
export async function startTopUp(
  amountUsd: number,
  getAccessToken: () => Promise<string>
): Promise<void> {
  const isLoaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
  if (!isLoaded) {
    throw new Error("Failed to load Razorpay SDK. Please check your internet connection.");
  }

  const token = await getAccessToken();
  const usdToInrRate = 83;
  const amountPaise = Math.round(amountUsd * usdToInrRate * 100);

  const backendUrl = resolveBrowserBackendUrl();
  const createOrderUrl = `${backendUrl}/api/v1/create-order`;

  const orderResponse = await fetch(createOrderUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR"
    })
  });

  if (!orderResponse.ok) {
    const errorText = await orderResponse.text();
    let parsedDetail = "Failed to create order";
    try {
      const parsed = JSON.parse(errorText);
      parsedDetail = parsed.detail || parsed.message || parsedDetail;
    } catch {
      parsedDetail = errorText || parsedDetail;
    }
    throw new Error(`Order creation failed: ${parsedDetail}`);
  }

  const orderData = await orderResponse.json();
  const { order_id } = orderData;

  if (typeof order_id === "string" && order_id.startsWith("admin_")) {
    const verifyUrl = `${backendUrl}/api/v1/verify-payment`;
    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        razorpay_order_id: order_id,
        razorpay_payment_id: "admin_auto_payment",
        razorpay_signature: "admin_auto_signature"
      })
    });

    if (!verifyResponse.ok) {
      throw new Error("Failed to verify admin credit grant");
    }

    if (typeof window !== "undefined") {
      window.location.reload();
    }
    return;
  }

  return new Promise<void>((resolve, reject) => {
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TD0IE8tqUIcoXr",
      amount: amountPaise,
      currency: "INR",
      name: "AAL Voice Builder",
      description: `Purchase of $${amountUsd} credits`,
      order_id: order_id,
      handler: async function (response: any) {
        try {
          const verifyUrl = `${backendUrl}/api/v1/verify-payment`;
          const verifyResponse = await fetch(verifyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });

          if (!verifyResponse.ok) {
            const errorText = await verifyResponse.text();
            let parsedDetail = "Signature verification failed";
            try {
              const parsed = JSON.parse(errorText);
              parsedDetail = parsed.detail || parsed.message || parsedDetail;
            } catch {
              parsedDetail = errorText || parsedDetail;
            }
            throw new Error(parsedDetail);
          }

          resolve();
        } catch (err: any) {
          reject(err);
        }
      },
      prefill: {
        name: "",
        email: ""
      },
      theme: {
        color: "#E88C15"
      },
      modal: {
        ondismiss: function () {
          reject(new Error("Payment cancelled by user."));
        }
      }
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  });
}


// Minimum self-serve top-up amount in INR.
export const MIN_TOPUP_INR = 10;

// Maximum self-serve top-up amount in INR (guards against fat-finger typos
// before the real Razorpay order is created).
export const MAX_TOPUP_INR = 100000;

// Preset chip amounts (INR ₹).
export const TOPUP_PRESETS = [100, 250, 500, 1000, 5000] as const;

