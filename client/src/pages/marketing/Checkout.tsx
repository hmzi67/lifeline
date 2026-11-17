import React, { useState, useMemo } from 'react';
import { Check, Plus, Minus, Trash } from 'lucide-react';

interface Product {
    id: string;
    name: string;
    version?: string;
    price: number;
    image: 'fitness-band' | 'app';
    quantity: number;
    selected: boolean;
}

const Checkout: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([
        {
            id: '1',
            name: 'Fitness Band',
            version: 'v2',
            price: 99.0,
            image: 'fitness-band',
            quantity: 1,
            selected: true
        },
        {
            id: '2',
            name: '30 Days Free Access to LifeLine',
            price: 0,
            image: 'app',
            quantity: 1,
            selected: true
        }
    ]);

    const [couponCode, setCouponCode] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('gpay');
    const [agreeToTerms, setAgreeToTerms] = useState(false);

    // Dynamic price calculations
    const calculations = useMemo(() => {
        const selectedProducts = products.filter(p => p.selected);
        const subtotal = selectedProducts.reduce((sum, product) => sum + (product.price * product.quantity), 0);

        // Codes are checked and priced by the server at payment (Pricing page); none is applied here.
        const discountAmount = 0;
        const orderAmount = Math.max(0, subtotal - discountAmount);
        const taxRate = 0.18;
        const taxes = orderAmount * taxRate;
        const payableAmount = orderAmount + taxes;

        return {
            subtotal,
            discountAmount,
            orderAmount,
            taxes,
            payableAmount
        };
    }, [products]);

    const handleQuantityChange = (productId: string, increment: boolean) => {
        setProducts(prev => prev.map(product => {
            if (product.id === productId) {
                const newQuantity = increment ? product.quantity + 1 : Math.max(1, product.quantity - 1);
                return { ...product, quantity: newQuantity };
            }
            return product;
        }));
    };

    const handleProductToggle = (productId: string) => {
        setProducts(prev => prev.map(product =>
            product.id === productId ? { ...product, selected: !product.selected } : product
        ));
    };

    const addProduct = (newProduct: Omit<Product, 'id'>) => {
        const id = (products.length + 1).toString();
        setProducts(prev => [...prev, { ...newProduct, id }]);
    };

    const removeProduct = (productId: string) => {
        setProducts(prev => prev.filter(product => product.id !== productId));
    };

    const renderProductImage = (imageType: 'fitness-band' | 'app') => {
        if (imageType === 'fitness-band') {
            return (
                <div className="w-12 h-8 bg-gray-800 rounded-lg relative">
                    <div className="w-2 h-2 bg-primary-400 rounded-full absolute top-1 left-1"></div>
                </div>
            );
        } else {
            return (
                <div className="w-12 h-10 bg-white rounded border-2 border-gray-300 flex items-center justify-center">
                    <div className="text-xs text-gray-600">App</div>
                </div>
            );
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Create Order */}
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-semibold text-gray-900">Create Order</h2>
                                <p className="text-gray-600 mt-1">Selected product and services</p>
                            </div>
                            <div className="text-3xl font-bold text-primary-500">
                                ${calculations.payableAmount.toFixed(1)}
                            </div>
                        </div>

                        {/* Products List */}
                        <div className="space-y-4 mb-6">
                            {products.map((product) => (
                                <div key={product.id} className="border rounded-lg p-4">
                                    <div className="flex items-center space-x-4">
                                        <button
                                            onClick={() => handleProductToggle(product.id)}
                                            className={`w-6 h-6 rounded flex items-center justify-center ${
                                                product.selected ? 'bg-primary-500' : 'border-2 border-gray-300'
                                            }`}
                                        >
                                            {product.selected && <Check className="w-4 h-4 text-white" />}
                                        </button>

                                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                                            {renderProductImage(product.image)}
                                        </div>

                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-900">{product.name}</h3>
                                            {product.version && (
                                                <p className="text-sm text-gray-500">{product.version}</p>
                                            )}
                                            <p className="text-teal-500 font-semibold">
                                                {product.price === 0 ? 'Free' : `$${product.price.toFixed(2)}`}
                                            </p>
                                        </div>

                                        <div className="flex items-center space-x-2 border rounded-lg px-3 py-1">
                                            <button
                                                onClick={() => handleQuantityChange(product.id, false)}
                                                className="text-gray-400 hover:text-gray-600"
                                                disabled={product.quantity <= 1}
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="font-semibold text-gray-900 min-w-[20px] text-center">
                        {product.quantity}
                      </span>
                                            <button
                                                onClick={() => handleQuantityChange(product.id, true)}
                                                className="text-gray-400 hover:text-gray-600"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => removeProduct(product.id)}
                                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                                        >
                                            <Trash className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add Product Button - Example */}
                        <button
                            onClick={() => addProduct({
                                name: 'Premium Service',
                                price: 49.99,
                                image: 'app',
                                quantity: 1,
                                selected: true
                            })}
                            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-primary-500 hover:text-primary-500 mb-6"
                        >
                            + Add Product
                        </button>

                        {/* Order Summary */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-semibold text-gray-900">Order Total</span>
                                <span className="text-lg font-semibold text-gray-900">
                  {calculations.subtotal.toFixed(2)}
                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Discounts</span>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        placeholder="Enter Coupon Code"
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value)}
                                        className="text-sm border rounded px-2 py-1 text-gray-600 w-32"
                                    />
                                    {couponCode && (
                                        <span className="text-sm bg-primary-100 text-primary-600 px-2 py-1 rounded">
                      {couponCode}
                    </span>
                                    )}
                                    <span className="text-red-600">
                    (-) {calculations.discountAmount.toFixed(2)}
                  </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Order Amount</span>
                                <span className="text-gray-900">{calculations.orderAmount.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Taxes</span>
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-500">IGST@ 18%</span>
                                    <span className="text-gray-900">{calculations.taxes.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t">
                                <span className="text-lg font-semibold text-gray-900">Payable Amount</span>
                                <span className="text-lg font-semibold text-gray-900">
                  {calculations.payableAmount.toFixed(2)}
                </span>
                            </div>
                        </div>

                        {calculations.discountAmount > 0 && (
                            <div className="mt-6 text-primary-500 font-medium">
                                Congratulations! You've got free delivery.
                            </div>
                        )}
                    </div>

                    {/* Right Column - Confirm Order */}
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-semibold text-gray-900">Confirm Your Order</h2>
                                <p className="text-gray-600 mt-1">Selected product and services</p>
                            </div>
                            <div className="text-3xl font-bold text-primary-500">
                                ${calculations.payableAmount.toFixed(1)}
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-semibold text-gray-900">Order Total</span>
                                <span className="text-lg font-semibold text-gray-900">
                  {calculations.subtotal.toFixed(2)}
                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Discounts</span>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        placeholder="Enter Coupon Code"
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value)}
                                        className="text-sm border rounded px-2 py-1 text-gray-600 w-32"
                                    />
                                    {couponCode && (
                                        <span className="text-sm bg-teal-100 text-primary-600 px-2 py-1 rounded">
                      {couponCode}
                    </span>
                                    )}
                                    <span className="text-red-600">
                    (-) {calculations.discountAmount.toFixed(2)}
                  </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Order Amount</span>
                                <span className="text-gray-900">{calculations.orderAmount.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Taxes</span>
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm text-gray-500">IGST@ 18%</span>
                                    <span className="text-gray-900">{calculations.taxes.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t">
                                <span className="text-lg font-semibold text-gray-900">Payable Amount</span>
                                <span className="text-lg font-semibold text-gray-900">
                  {calculations.payableAmount.toFixed(2)}
                </span>
                            </div>
                        </div>

                        {/* Payment Method Selection */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Payment Method</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    className={`border rounded-lg p-4 cursor-pointer ${
                                        paymentMethod === 'gpay' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                                    }`}
                                    onClick={() => setPaymentMethod('gpay')}
                                >
                                    <div className="flex items-center space-x-2 mb-2">
                                        <div className={`w-4 h-4 rounded-full border-2 ${
                                            paymentMethod === 'gpay' ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                                        }`}>
                                            {paymentMethod === 'gpay' && <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>}
                                        </div>
                                        <span className="font-medium text-gray-900">G pay</span>
                                    </div>
                                    <p className="text-sm text-gray-600">Your current wallet balance is</p>
                                    <p className="text-sm font-semibold text-gray-900">$99.0</p>
                                </div>

                                <div
                                    className={`border rounded-lg p-4 cursor-pointer ${
                                        paymentMethod === 'others' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                                    }`}
                                    onClick={() => setPaymentMethod('others')}
                                >
                                    <div className="flex items-center space-x-2 mb-2">
                                        <div className={`w-4 h-4 rounded-full border-2 ${
                                            paymentMethod === 'others' ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                                        }`}>
                                            {paymentMethod === 'others' && <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>}
                                        </div>
                                        <span className="font-medium text-gray-900">Others</span>
                                    </div>
                                    <p className="text-sm text-gray-600">Pay by</p>
                                    <p className="text-sm font-semibold text-gray-900">Card/UPI/Net banking</p>
                                </div>
                            </div>
                        </div>

                        {/* Terms and Conditions */}
                        <div className="mb-6">
                            <label className="flex items-start space-x-3">
                                <input
                                    type="checkbox"
                                    checked={agreeToTerms}
                                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 mt-1"
                                />
                                <span className="text-sm text-gray-600">
                 By proceeding, I confirm that I have read and agree to the Terms & Conditions and Privacy Policy.
                </span>
                            </label>
                        </div>

                        {/* Checkout Button */}
                        <button
                            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
                                agreeToTerms
                                    ? 'bg-primary-500 hover:bg-primary-600'
                                    : 'bg-gray-300 cursor-not-allowed'
                            }`}
                            disabled={!agreeToTerms}
                        >
                            Checkout
                        </button>

                        <p className="text-center text-sm text-gray-500 mt-3 italic">
                            You’ll be redirected to a secure third-party payment gateway.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;

