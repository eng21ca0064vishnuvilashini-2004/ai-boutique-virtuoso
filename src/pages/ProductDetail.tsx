import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Heart, Sparkles, Camera } from "lucide-react";
import { VirtualTryOn } from "@/components/VirtualTryOn";

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [showTryOn, setShowTryOn] = useState(false);

  const { data: product } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("slug", slug)
        .single();
      
      if (data) {
        // Track browsing history
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from("browsing_history").insert({
            user_id: session.user.id,
            product_id: data.id,
          });
        }
      }
      
      return data;
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      if (!selectedSize && product!.sizes.length > 0) {
        throw new Error("Please select a size");
      }
      if (!selectedColor && product!.colors.length > 0) {
        throw new Error("Please select a color");
      }

      const { data, error } = await supabase
        .from("cart_items")
        .upsert({
          user_id: session.user.id,
          product_id: product!.id,
          quantity: 1,
          size: selectedSize,
          color: selectedColor,
        }, {
          onConflict: "user_id,product_id,size,color"
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to cart!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-muted relative group">
              <img
                src={product.images?.[0] || "/placeholder.svg"}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <Button
                variant="premium"
                className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setShowTryOn(true)}
              >
                <Camera className="mr-2 h-4 w-4" />
                Virtual Try-On
              </Button>
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <Badge className="mb-4">{(product as any).categories?.name}</Badge>
              <h1 className="text-4xl font-bold mb-4">{product.name}</h1>
              <p className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-6">
                ${product.price}
              </p>
              <p className="text-muted-foreground leading-relaxed">{product.description}</p>
            </div>

            {/* Size Selection */}
            {product.sizes.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-3 block">Select Size</label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <Button
                      key={size}
                      variant={selectedSize === size ? "default" : "outline"}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Selection */}
            {product.colors.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-3 block">Select Color</label>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <Button
                      key={color}
                      variant={selectedColor === color ? "default" : "outline"}
                      onClick={() => setSelectedColor(color)}
                    >
                      {color}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock Info */}
            <div>
              {product.stock > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {product.stock < 10 && `Only ${product.stock} left in stock`}
                </p>
              ) : (
                <Badge variant="destructive">Out of Stock</Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                variant="premium"
                size="lg"
                className="flex-1"
                onClick={() => addToCartMutation.mutate()}
                disabled={product.stock === 0}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                Add to Cart
              </Button>
              <Button variant="outline" size="lg">
                <Heart className="h-5 w-5" />
              </Button>
            </div>

            {/* AI Features Banner */}
            <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/20">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">AI-Powered Experience</h3>
                  <p className="text-sm text-muted-foreground">
                    Get personalized recommendations and try our virtual try-on feature to see how this looks on you!
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Virtual Try-On Modal */}
      {showTryOn && (
        <VirtualTryOn
          product={product}
          onClose={() => setShowTryOn(false)}
        />
      )}
    </div>
  );
};

export default ProductDetail;
