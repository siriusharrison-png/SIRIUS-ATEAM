import { z } from "zod";
import { useCurrentFrame, interpolate } from "remotion";

export const placeholderSchema = z.object({
  title: z.string().default("MotionLab"),
});

export const PlaceholderComp: React.FC<z.infer<typeof placeholderSchema>> = ({
  title,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        fontSize: 80,
        backgroundColor: "#0d0d0d",
        color: "#fff",
      }}
    >
      {title}
    </div>
  );
};
