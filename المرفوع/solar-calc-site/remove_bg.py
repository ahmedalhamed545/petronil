import os
import sys
from PIL import Image, ImageFilter

def remove_background(image_path, output_path, threshold=45):
    if not os.path.exists(image_path):
        print(f"Error: {image_path} does not exist.")
        return False
        
    img = Image.open(image_path).convert("RGBA")
    datas = img.getdata()
    
    # Get background color from the top-left corner
    bg_color = datas[0]
    print(f"Detected background color: {bg_color[:3]}")
    
    new_data = []
    for item in datas:
        # Calculate Euclidean distance between item color and background color
        r_diff = abs(item[0] - bg_color[0])
        g_diff = abs(item[1] - bg_color[1])
        b_diff = abs(item[2] - bg_color[2])
        
        # If the pixel color is close to the background color, make it transparent
        if r_diff < threshold and g_diff < threshold and b_diff < threshold:
            new_data.append((255, 255, 255, 0)) # transparent
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    
    # Optional: Apply some smoothing/anti-aliasing to edges
    # We can do this by using a soft mask
    img.save(output_path, "PNG")
    print(f"Saved transparent logo to {output_path}")
    return True

if __name__ == "__main__":
    src = "logo.jpg"
    dest = "logo.png"
    remove_background(src, dest)
