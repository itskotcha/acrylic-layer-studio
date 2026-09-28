import { useStudio } from "../store";
import { fontStyle } from "../fonts";
import { useEffect, useState } from "react";
import { Image, Text, Shape, Rect, Group } from "react-konva";
import { loadImage } from "../io";
import { strokeCanvas } from "../brushes";
import { backgroundAttrs, textRenderAttrs } from "../rendering";
import type { ArtObject, Assets } from "../model";
export default function ArtNode({
  o,
  assets,
  scale = 1,
  ...props
}: { o: ArtObject; assets: Assets; scale?: number } & Record<string, any>) {
  const p = useStudio((s) => s.project);
  const [image, setImage] = useState<HTMLImageElement>();
  const [fontRevision, setFontRevision] = useState(0);
  const style = fontStyle(p, o.fontFamily);
  useEffect(() => {
    let active = true;
    if (o.type === "text")
      document.fonts
        .load(`${style} 64px "${o.fontFamily}"`, "ภาษาไทย ABC")
        .then(() => {
          if (active) setFontRevision((v) => v + 1);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [o.type, o.fontFamily, style]);
  useEffect(() => {
    let active = true;
    if (o.type === "image" && assets[o.assetId!])
      loadImage(assets[o.assetId!].data)
        .then((im) => {
          if (active) setImage(im);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [o.assetId, assets[o.assetId || ""]?.data]);
  if (o.type === "image") return <Image {...o} {...props} image={image} />;
  if (o.type === "text")
    return (
      <Group {...o} {...props}>
        <Text
          key={fontRevision}
          {...textRenderAttrs(o)}
          fontStyle={fontStyle(p, o.fontFamily)}
        />
      </Group>
    );
  if (o.type === "background")
    return <Rect {...o} {...backgroundAttrs(o)} {...props} />;
  return (
    <Shape
      {...o}
      {...props}
      sceneFunc={(ctx) =>
        ctx.drawImage(strokeCanvas(o, scale), 0, 0, o.width, o.height)
      }
      hitFunc={(ctx, shape) => {
        ctx.beginPath();
        ctx.rect(0, 0, o.width, o.height);
        ctx.closePath();
        ctx.fillStrokeShape(shape);
      }}
    />
  );
}
