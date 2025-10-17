import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useSearchParams } from "react-router-dom";
import { Filter, SortAsc, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Products = () => {
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(category);

  const { data: products } = useQuery({
    queryKey: ["products", selectedCategory],
    queryFn: async () => {
      let query = supabase.from("products").select("*, categories(name)");
      
      if (selectedCategory) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", selectedCategory)
          .single();
        if (cat) {
          query = query.eq("category_id", cat.id);
        }
      }
      
      const { data } = await query;
      return data || [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*");
      return data || [];
    },
  });

  const { data: recommendations } = useQuery({
    queryKey: ["recommendations"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const { data } = await supabase.functions.invoke("get-recommendations", {
        body: { userId: session.user.id },
      });
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {selectedCategory ? `${selectedCategory} Collection` : "All Products"}
          </h1>
          <p className="text-muted-foreground text-lg">Discover luxury fashion curated just for you</p>
        </div>

        {/* AI Recommendations */}
        {recommendations && recommendations.recommendations?.length > 0 && (
          <div className="mb-12 p-6 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Recommended For You</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommendations.recommendations.slice(0, 4).map((rec: any) => (
                <Link key={rec.product_id} to={`/product/${rec.product_slug}`}>
                  <Card className="p-4 hover:shadow-glow transition-all">
                    <p className="text-sm font-medium">{rec.product_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{rec.reason}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            onClick={() => setSelectedCategory(null)}
          >
            All Products
          </Button>
          {categories?.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.slug ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat.slug)}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products?.map((product) => (
            <Link key={product.id} to={`/product/${product.slug}`}>
              <Card className="group overflow-hidden hover:shadow-glow transition-all duration-300 h-full">
                <div className="aspect-[3/4] overflow-hidden bg-muted relative">
                  <img
                    src={product.images?.[0] || "/placeholder.svg"}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  {product.stock < 10 && product.stock > 0 && (
                    <Badge className="absolute top-3 right-3 bg-secondary">
                      Only {product.stock} left
                    </Badge>
                  )}
                  {product.stock === 0 && (
                    <Badge variant="destructive" className="absolute top-3 right-3">
                      Out of Stock
                    </Badge>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    {(product as any).categories?.name}
                  </p>
                  <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-1">
                    {product.name}
                  </h3>
                  <p className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    ${product.price}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {products?.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No products found in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
