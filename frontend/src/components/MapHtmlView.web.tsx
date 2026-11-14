import { createElement } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

type Props = { html: string; style?: StyleProp<ViewStyle> };

// Web: same MapLibre page as the native WebView, shown in a sandboxed iframe.
export default function MapHtmlView({ html, style }: Props) {
  return (
    <View style={[{ flex: 1 }, style]}>
      {createElement("iframe", {
        srcDoc: html,
        title: "Bản đồ",
        sandbox: "allow-scripts",
        style: { border: 0, width: "100%", height: "100%" },
      })}
    </View>
  );
}
