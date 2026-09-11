import { DropdownMenu as KumoDropdownMenu } from "@cloudflare/kumo";

// Thin re-export under this app's existing names — Kumo's compound API
// (DropdownMenu.Trigger, .Content, .Item, .CheckboxItem) already matches
// the shape this app's call sites use, so no call-site changes are needed
// beyond the import.
const DropdownMenu = KumoDropdownMenu;
const DropdownMenuTrigger = KumoDropdownMenu.Trigger;
const DropdownMenuContent = KumoDropdownMenu.Content;
const DropdownMenuItem = KumoDropdownMenu.Item;
const DropdownMenuCheckboxItem = KumoDropdownMenu.CheckboxItem;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
};
