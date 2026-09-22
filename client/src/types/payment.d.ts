export {};
declare global { interface Window { Razorpay: new (options: { key: string; amount: number; currency: string; name: string; description: string; order_id: string; prefill: {name:string;email:string;contact:string}; theme: {color:string}; handler: (response: any)=>void; modal?: {ondismiss:()=>void} }) => {open:()=>void}; } }
