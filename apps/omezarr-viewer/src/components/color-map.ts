
// an IM-gui widget for controlling the display of a single channel

import { Interval } from "@aibs-vis/geometry";
import { ImGui } from "@zhobo63/imgui-ts";
import { ImTuple2 } from "@zhobo63/imgui-ts/src/bind-imgui";
import { ImGuiColorEditFlags, ImGuiSliderFlags, ImVec4 } from "@zhobo63/imgui-ts/src/imgui";

// assumes its mid-frame of an IMGui.newFrame() when called!

export function colorMapWidget(channel: string, mutable: {
    useMe: boolean, color: ImVec4, gamut: Interval
}) {
    let changed = false;
    const { gamut, color } = mutable;
    const range: ImTuple2<number> = [gamut.min, gamut.max];
    if (ImGui.Checkbox("", (b?: boolean) => { mutable.useMe = b ?? mutable.useMe; return mutable.useMe })) {
        changed = true;
    }
    ImGui.SameLine();
    ImGui.ColorButton(" ", color, ImGuiColorEditFlags.NoAlpha)
    ImGui.SameLine();
    if (ImGui.SliderFloat2(channel, range, 0, 9999, "%3f", ImGuiSliderFlags.Logarithmic)) {
        mutable.gamut = { min: range[0], max: range[1] }
        changed = true;
    }
    return { changed, ...mutable };
}