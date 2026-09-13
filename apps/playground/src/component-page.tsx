// One page per component, rendered from docs/components/contracts.json — the
// machine-readable twin of docs/components/*.md, written by the same generator
// from the same assembled contract. Nothing on these pages is typed by hand
// here: a prop's name, type and default are parsed from
// packages/react/src/<name>.tsx, and what each prop is *for* comes from
// registry/components/<name>.json. If the two disagree the docs build fails,
// so a page that renders at all is a page whose halves agree.
//
// The live demos are the one thing this file adds, and they are deliberately
// the only hand-written part: a contract can say `loading` shows a spinner and
// refuses clicks, but only a real button can be clicked.
import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  ButtonGroup,
  Checkbox,
  Dialog,
  Menu,
  MenuItem,
  MenuSeparator,
  Notice,
  Radio,
  RadioGroup,
  MobileNav,
  Search,
  SideNav,
  Tabs,
  TopNav,
  Spinner,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@rata/react";
import type {
  AvatarSize,
  BadgeVariant,
  ButtonGroupOrientation,
  DialogSize,
  SearchSize,
  NoticeLive,
  NoticeVariant,
  TextFieldSize,
  TextFieldStatus,
  ToggleButtonGroupSelectionMode,
  ButtonSize,
  ButtonVariant,
  ToggleButtonSize,
  ToggleButtonVariant,
} from "@rata/react";
import type { TabsActivation, TabsOrientation } from "@rata/primitives";
import type { TabsVariant } from "@rata/react";
import type { IconSize, LucideIcon } from "@rata/icons";
import {
  Icon,
  Settings,
  User,
  X,
  Trash2,
  Ellipsis,
  Pencil,
  Copy,
  Upload,
  Download,
  CircleAlert,
  ChevronLeft,
  ChevronRight,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "@rata/icons";
import { COMPONENT_TABS, componentPage, hrefFor } from "./routing.js";
import type { ComponentTab, Page } from "./routing.js";
import contractsJson from "../../../docs/components/contracts.json";

export interface ContractProp {
  name: string;
  type: string;
  /** String-literal members of the prop's union type, when it is one — resolved from source. */
  values?: string[];
  optional: boolean;
  default?: string | null;
  description?: string | null;
  declared: boolean;
  summary: string | null;
  use: string[];
  dont: string[];
  conflicts: string[];
  a11y: string | null;
}

export interface Contract {
  name: string;
  title: string;
  description: string;
  family: string;
  tier: string;
  status: Record<string, { state: string; version?: string } | undefined>;
  dependencies: string[];
  importPath: string;
  /** `documented` = implemented and cross-checked, `spec` = approved intent, `css-only` = no props API by design. */
  mode: "documented" | "spec" | "css-only";
  note: string | null;
  extends: string | null;
  props: ContractProp[];
  usage: Array<{ case: string; when?: string; example?: string; notes?: string }>;
  behavior: {
    primitive?: string;
    summary?: string;
    decisions?: Array<{ decision: string; why: string }>;
  } | null;
  tokens: Record<string, { summary?: string; tokens: Record<string, string> }>;
  example: string | null;
}

export const contracts = (contractsJson as unknown as Contract[])
  .slice()
  .sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));

export const contractsByName = new Map(contracts.map((c) => [c.name, c]));

/**
 * Artifact status, rendered with the system's own Badge.
 *
 * This used to be a hand-rolled `.pg-status` span with its own five colour
 * rules — a badge in everything but name, written before there was a Badge to
 * use. Two things came of replacing it: the duplicate stylesheet went, and the
 * `na`/`deprecated` pills stopped pairing fg.muted with bg.muted, which
 * measures 4.19:1 in dark and is documented as AA-large only. Badge's neutral
 * variant uses fg.secondary, at 5.75:1.
 */
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  latest: "success",
  "in-progress": "warning",
  future: "neutral",
  na: "neutral",
  deprecated: "neutral",
  tbd: "neutral",
};

export function StatusPill({ artifact }: { artifact?: { state: string; version?: string } }) {
  const state = artifact?.state ?? "tbd";
  return (
    <Badge variant={STATUS_VARIANT[state] ?? "neutral"}>
      {state}
      {artifact?.version ? ` · ${artifact.version}` : ""}
    </Badge>
  );
}

// ---- Live demo -----------------------------------------------------------
// Only for a component with no interactive spec of its own. Everything else
// is shown by the showcase panel at the top of the Overview and by the
// example cards below it, both driven by the contract — so the hand-written
// grids that used to live here for Button, ButtonGroup, Spinner and
// ToggleButton were unreachable duplicates of that, and are gone.

const DEMOS: Record<string, () => ReactNode> = {
  "state-layer": () => (
    <div className="pg-row">
      <span className="pg-row-label">hover / press</span>
      <button type="button" className="pg-demo-surface rata-state-layer">
        Composed onto any element
      </button>
    </div>
  ),
};

// ---- Examples -------------------------------------------------------------
// One card per entry in the contract's `usage` array. The title, the caption,
// the description and the code all come from the contract — the only thing
// written here is the live render, because a JSX string in a JSON file cannot
// be executed and this app ships no runtime compiler.
//
// Keyed by component name, then by the contract's `case` text verbatim. A case
// with no entry still gets a card; it just shows the code without a specimen,
// which is the honest outcome rather than a mocked-up one.

const EXAMPLES: Record<string, Record<string, () => ReactNode>> = {
  button: {
    "Primary action with async work": () => <SaveExample />,
    "Destructive action in a confirmation": () => (
      <>
        <Button variant="secondary">Keep project</Button>
        <Button variant="destructive">Delete project</Button>
      </>
    ),
    "Icon-only row action": () => (
      <Button variant="tertiary" size="sm" iconOnly aria-label="Remove row">
        <Icon icon={X} size="sm" />
      </Button>
    ),
  },

  "button-group": {
    "Two actions at the end of a form": () => (
      <ButtonGroup label="Form actions">
        <Button variant="secondary">Cancel</Button>
        <Button>Save changes</Button>
      </ButtonGroup>
    ),
    "Attached pager": () => (
      <ButtonGroup label="Pagination" attached>
        <Button variant="secondary" iconOnly aria-label="Previous page">
          <Icon icon={ChevronLeft} />
        </Button>
        <Button variant="secondary" iconOnly aria-label="Next page">
          <Icon icon={ChevronRight} />
        </Button>
      </ButtonGroup>
    ),
    "Named by a heading that is already on screen": () => (
      <div>
        <h4 id="example-export-actions" className="pg-example-heading">
          Export
        </h4>
        <ButtonGroup labelledBy="example-export-actions">
          <Button variant="secondary">CSV</Button>
          <Button variant="secondary">JSON</Button>
        </ButtonGroup>
      </div>
    ),
    "Vertical rail": () => (
      <ButtonGroup label="Layer actions" orientation="vertical" attached>
        <Button variant="secondary">Bring forward</Button>
        <Button variant="secondary">Send backward</Button>
      </ButtonGroup>
    ),
  },

  icon: {
    "Inside an icon-only button": () => (
      <Button iconOnly aria-label="Delete row">
        <Icon icon={Trash2} />
      </Button>
    ),
    "Beside a text label": () => (
      <Button>
        <Icon icon={Download} />
        Export CSV
      </Button>
    ),
    "Carrying meaning on its own": () => (
      <Icon icon={CircleAlert} size="xs" label="Needs review" />
    ),
  },

  "text-field": {
    "Plain labelled field with a format hint": () => (
      <TextField className="pg-field" label="Email" description="We’ll only use this for receipts." placeholder="name@example.com" />
    ),
    "Failed validation after blur": () => (
      <TextField className="pg-field"
        label="Email"
        status="invalid"
        message="Use the format name@example.com"
        defaultValue="name@"
      />
    ),
    "Async uniqueness check in flight": () => (
      <TextField className="pg-field"
        label="Workspace URL"
        status="validating"
        message="Checking availability…"
        defaultValue="acme"
      />
    ),
    "A passing async check, confirmed": () => (
      <TextField
        className="pg-field"
        label="Workspace URL"
        status="valid"
        message="acme.example.com is available"
        defaultValue="acme"
      />
    ),
    "Unavailable but readable": () => (
      <TextField className="pg-field" label="State" disabled description="Choose a country first." />
    ),
    "Purpose already clear on screen": () => (
      <TextField className="pg-field" label="Search" labelHidden placeholder="Search…" />
    ),
  },

  checkbox: {
    "A single consent box": () => <ConsentExample />,
    "A parent summarising a list": () => <SelectAllExample />,
    "Unavailable but still readable": () => (
      <Checkbox label="Ship to billing address" checked disabled />
    ),
  },

  "radio-group": {
    "Choosing one of a few": () => <BillingExample />,
    "An option that cannot be chosen yet": () => (
      <RadioGroup label="Shipping" defaultValue="standard">
        <Radio value="standard" label="Standard" />
        <Radio
          value="overnight"
          label="Overnight"
          disabled
          description="Not available to this address"
        />
      </RadioGroup>
    ),
  },

  radio: {
    "Inside its group": () => <RadioStage />,
  },

  badge: {
    "A count beside a label": () => (
      <>
        <Button>
          Messages
          <Badge variant="accent">3</Badge>
        </Button>
        <Button variant="secondary">
          Notifications
          <Badge variant="warning">12</Badge>
        </Button>
        <Button variant="tertiary">
          Updates
          <Badge>New</Badge>
        </Button>
      </>
    ),
    "A status in a table row": () => (
      <>
        <Badge variant="success" dot>
          Passing
        </Badge>
        <Badge variant="warning" dot>
          Degraded
        </Badge>
        <Badge variant="danger" dot>
          Failed
        </Badge>
      </>
    ),
  },

  avatar: {
    "A photo with its name beside it": () => (
      <span className="pg-example-inline">
        <Avatar name="Ada Hartley" decorative />
        <span>Ada Hartley</span>
      </span>
    ),
    "Standing alone": () => <Avatar name="Ada Hartley" />,
    "No image at all": () => (
      <>
        <Avatar name="Ada Hartley" size="sm" />
        <Avatar name="Bo Nakamura" size="md" />
        <Avatar name="Chidi Okonkwo" size="lg" />
      </>
    ),
  },

  "mobile-nav": {
    "A drawer beside a rail, sharing one set of destinations": () => (
      <MobileNav
        title="Ratā"
        label="Main"
        sections={[
          {
            items: [
              { label: "Invoices", href: "#", current: true },
              { label: "Clients", href: "#" },
              {
                label: "Reports",
                items: [
                  { label: "Revenue", href: "#" },
                  { label: "Ageing", href: "#" },
                ],
              },
            ],
          },
        ]}
      />
    ),
    "A drawer with account actions under the destinations": () => (
      <MobileNav
        title="Ratā"
        sections={[
          {
            items: [
              { label: "Invoices", href: "#", current: true },
              { label: "Clients", href: "#" },
            ],
          },
        ]}
        footer={
          <>
            <Button variant="secondary">Settings</Button>
            <Button variant="tertiary">Sign out</Button>
          </>
        }
      />
    ),
  },

  "side-nav": {
    "A grouped rail inside one area of the product": () => (
      <SideNav
        className="pg-rail"
        label="Invoices"
        sections={[
          {
            label: "Billing",
            items: [
              { label: "Invoices", href: "#", current: true },
              { label: "Credit notes", href: "#" },
            ],
          },
          {
            label: "Setup",
            items: [
              { label: "Tax rates", href: "#" },
              { label: "Templates", href: "#" },
            ],
          },
        ]}
      />
    ),
    "A group with pages nested under it": () => (
      <SideNav
        className="pg-rail"
        label="Invoices"
        sections={[
          {
            items: [
              { label: "All invoices", href: "#" },
              {
                label: "Reports",
                items: [
                  { label: "Revenue", href: "#", current: true },
                  { label: "Ageing", href: "#" },
                  { label: "Tax summary", href: "#" },
                ],
              },
              { label: "Credit notes", href: "#" },
            ],
          },
        ]}
      />
    ),
    "A flat rail, with nothing to group": () => (
      <SideNav
        className="pg-rail"
        label="Settings"
        sections={[
          {
            items: [
              { label: "Profile", href: "#", current: true },
              { label: "Notifications", href: "#" },
              { label: "Security", href: "#" },
            ],
          },
        ]}
      />
    ),
  },

  tabs: {
    "One thing seen several ways": () => (
      <Tabs
        label="Invoice"
        items={[
          { value: "details", label: "Details", content: "Amount, dates, and the client." },
          { value: "history", label: "History", content: "Every change, most recent first." },
          { value: "notes", label: "Notes", content: "Anything the team wrote down." },
        ]}
      />
    ),
    "Panels that cost something to open": () => <TabsManualStage />,
    "Drawn as a segmented control": () => (
      <div className="pg-block-stack">
        <Tabs
          label="Range"
          variant="segmented"
          items={[
            { value: "week", label: "Week", content: "Seven days of activity." },
            { value: "month", label: "Month", content: "A calendar month." },
            { value: "quarter", label: "Quarter", content: "Three months." },
          ]}
        />
        {/* The real segmented control, directly below, so the resemblance is
            visible — and so is the fact that only one of them is a tablist. */}
        <ToggleButtonGroup label="Billing period" defaultValue="monthly">
          <ToggleButton value="monthly">Monthly</ToggleButton>
          <ToggleButton value="annual">Annual</ToggleButton>
        </ToggleButtonGroup>
      </div>
    ),
  },

  "top-nav": {
    "An application banner": () => (
      <TopNav
        brand={<strong className="pg-brand">Ratā</strong>}
        items={[
          { label: "Invoices", href: "#", current: true },
          { label: "Clients", href: "#" },
          { label: "Reports", href: "#" },
        ]}
        actions={
          <Menu
            label="Account"
            trigger={
              <Button iconOnly aria-label="Account" variant="tertiary">
                <Icon icon={User} />
              </Button>
            }
          >
            <MenuItem icon={Settings} onSelect={() => {}}>Settings</MenuItem>
            <MenuItem onSelect={() => {}}>Sign out</MenuItem>
          </Menu>
        }
      />
    ),
    "A destination with sub-destinations": () => (
      <TopNav
        brand={<strong className="pg-brand">Ratā</strong>}
        items={[
          { label: "Invoices", href: "#" },
          {
            label: "Reports",
            current: true,
            items: [
              { label: "Revenue", href: "#", current: true },
              { label: "Ageing", href: "#" },
              { label: "Tax summary", href: "#" },
            ],
          },
          { label: "Clients", href: "#" },
        ]}
      />
    ),
    "A banner beside a side nav, where both landmarks need names": () => (
      <TopNav
        label="Main"
        brand={<strong className="pg-brand">Ratā</strong>}
        items={[
          { label: "Invoices", href: "#", current: true },
          { label: "Clients", href: "#" },
        ]}
      />
    ),
  },

  search: {
    "The site's search, in a header": () => (
      <Search landmark label="Search" placeholder="Search invoices" onSearch={() => {}} />
    ),
    "Filtering a list as you type": () => <SearchFilterStage size="sm" />,
    "A committed query that went to the network": () => <SearchPendingStage />,
  },

  dialog: {
    "A destructive confirmation": () => (
      <DialogStage description="Everything in it goes too." size="sm" />
    ),
    "A blocking error, where dismissing would lose work": () => (
      <DialogStage title="Connection lost" dismissible={false} destructive={false} />
    ),
  },

  "menu-item": {
    "A row with an icon": () => <MenuItemStage />,
    "A destructive row, kept away from the safe ones": () => (
      <MenuItemStage destructive icon={Trash2}>Delete</MenuItemStage>
    ),
    "A row that exists but cannot run yet": () => (
      <MenuItemStage disabled icon={Upload}>Publish</MenuItemStage>
    ),
  },

  menu: {
    "Actions on a row": () => (
      <Menu trigger={<Button variant="secondary">Actions</Button>}>
        <MenuItem icon={Copy} onSelect={() => {}}>Duplicate</MenuItem>
        <MenuItem icon={Download} onSelect={() => {}}>Download</MenuItem>
        <MenuSeparator />
        <MenuItem destructive icon={Trash2} onSelect={() => {}}>Delete</MenuItem>
      </Menu>
    ),
    "An icon-only trigger, which needs the list named separately": () => (
      <Menu
        label="Row actions"
        trigger={
          <Button iconOnly aria-label="Row actions" variant="tertiary">
            <Icon icon={Ellipsis} />
          </Button>
        }
      >
        <MenuItem icon={Pencil} onSelect={() => {}}>Edit</MenuItem>
        <MenuItem destructive icon={Trash2} onSelect={() => {}}>Delete</MenuItem>
      </Menu>
    ),
  },

  notice: {
    "A page-level message that is there when the page loads": () => (
      <Notice variant="warning">This project is read-only while the migration runs.</Notice>
    ),
    "An error that appears after an action, announced correctly": () => <SaveFailureExample />,
    "A dismissible confirmation, with focus handled": () => <InvitesExample />,
  },

  breadcrumbs: {
    "A page three levels deep": () => (
      <Breadcrumbs
        items={[
          { label: "Home", href: "#" },
          { label: "Reports", href: "#" },
          { label: "Q3 revenue" },
        ]}
      />
    ),
    "One landmark among several": () => (
      <Breadcrumbs
        label="Breadcrumb"
        items={[
          { label: "Settings", href: "#" },
          { label: "Billing" },
        ]}
      />
    ),
  },

  switch: {
    "A setting that applies immediately": () => <NotificationsExample />,
    "A setting whose consequence needs saying": () => (
      <Switch
        label="Public profile"
        description="Anyone with the link can see your activity."
        defaultChecked
      />
    ),
    "A row in a settings table": () => (
      <span className="pg-example-inline">
        <Switch label="Email digest" labelHidden defaultChecked />
        <Switch label="Push digest" labelHidden />
      </span>
    ),
  },

  spinner: {
    "Standalone region loading": () => <Spinner label="Loading results" />,
    "Inside a button": () => <Button loading>Saving…</Button>,
  },

  "toggle-button-group": {
    "Single choice — a segmented control": () => <AlignGroupExample />,
    "Independent states that sit together": () => <StyleGroupExample />,
    "A filter that can be cleared": () => <FilterGroupExample />,
  },

  "toggle-button": {
    "A formatting toggle in a toolbar": () => <BoldToggleExample />,
    "A toggle whose change has to reach a server": () => <StarToggleExample />,
    "Local-only state nothing else reads": () => (
      <ToggleButton defaultPressed>Show detail</ToggleButton>
    ),
  },
};

/**
 * `loading` is the whole point of this example, and a button frozen in the
 * loading state demonstrates the spinner but not the contract — that
 * activation is refused while the write is in flight. Clicking it actually
 * runs a fake save.
 */
function SaveExample() {
  const [saving, setSaving] = useState(false);
  return (
    <Button
      loading={saving}
      onClick={() => {
        setSaving(true);
        window.setTimeout(() => setSaving(false), 1400);
      }}
    >
      Save changes
    </Button>
  );
}

function BoldToggleExample() {
  const [bold, setBold] = useState(true);
  return (
    <ToggleButton
      variant="tertiary"
      iconOnly
      aria-label="Bold"
      pressed={bold}
      onPressedChange={setBold}
    >
      <Icon icon={Bold} />
    </ToggleButton>
  );
}

/** Held in `loading` deliberately: the contract says the state must not settle until the write lands. */
function StarToggleExample() {
  return (
    <ToggleButton pressed={false} loading>
      Star
    </ToggleButton>
  );
}

/** Single mode: a radiogroup — one tab stop, arrows move and select. */
function AlignGroupExample() {
  const [align, setAlign] = useState<string | null>("left");
  return (
    <ToggleButtonGroup
      label="Text alignment"
      value={align}
      onValueChange={(next) => setAlign(next as string | null)}
    >
      <ToggleButton value="left" iconOnly aria-label="Align left">
        <Icon icon={AlignLeft} />
      </ToggleButton>
      <ToggleButton value="center" iconOnly aria-label="Align center">
        <Icon icon={AlignCenter} />
      </ToggleButton>
      <ToggleButton value="right" iconOnly aria-label="Align right">
        <Icon icon={AlignRight} />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

/** Multiple mode: independent toggles, each keeping its own tab stop. */
function StyleGroupExample() {
  const [styles, setStyles] = useState<string[]>(["bold"]);
  return (
    <ToggleButtonGroup
      label="Text style"
      selectionMode="multiple"
      value={styles}
      onValueChange={(next) => setStyles(next as string[])}
    >
      <ToggleButton value="bold">Bold</ToggleButton>
      <ToggleButton value="italic">Italic</ToggleButton>
      <ToggleButton value="underline">Underline</ToggleButton>
    </ToggleButtonGroup>
  );
}

/** Single mode plus `deselectable`: clicking the selected option clears it. */
function FilterGroupExample() {
  const [status, setStatus] = useState<string | null>("open");
  return (
    <ToggleButtonGroup
      label="Status filter"
      deselectable
      value={status}
      onValueChange={(next) => setStatus(next as string | null)}
    >
      <ToggleButton value="open">Open</ToggleButton>
      <ToggleButton value="closed">Closed</ToggleButton>
    </ToggleButtonGroup>
  );
}

/** Controlled, because the consent value is the thing the page cares about. */
function ConsentExample() {
  const [subscribed, setSubscribed] = useState(true);
  return (
    <Checkbox
      label="Email me product updates"
      description="Roughly monthly. Unsubscribe from any of them."
      checked={subscribed}
      onCheckedChange={setSubscribed}
    />
  );
}

/**
 * The indeterminate case, live — a frozen screenshot of it would show the bar
 * but not the thing the state is *for*: that activating a partly-filled parent
 * resolves to checked rather than toggling from its own value.
 */
function SelectAllExample() {
  const [rows, setRows] = useState([true, false, false]);
  const all = rows.every(Boolean);
  const some = rows.some(Boolean);
  return (
    <span className="pg-example-stack">
      <Checkbox
        label="Select all"
        checked={all}
        indeterminate={some && !all}
        onCheckedChange={(next) => setRows(rows.map(() => next))}
      />
      {rows.map((on, i) => (
        <Checkbox
          key={i}
          label={`Row ${i + 1}`}
          checked={on}
          onCheckedChange={(next) => setRows(rows.map((v, j) => (j === i ? next : v)))}
        />
      ))}
    </span>
  );
}

/** Arrow keys move and select here, which is the pattern a frozen demo hides. */
function BillingExample() {
  const [period, setPeriod] = useState<string | null>("annual");
  return (
    <RadioGroup label="Billing period" value={period} onValueChange={setPeriod}>
      <Radio value="monthly" label="Monthly" />
      <Radio value="annual" label="Annual" description="Two months free" />
    </RadioGroup>
  );
}

/**
 * A single Radio, staged.
 *
 * A Radio rendered alone throws — alone it has no name to share and no siblings
 * to be exclusive with — so a group is always present. Kept to one option, so
 * the specimen is unmistakably the item rather than the question; the question
 * has its own specimen on the RadioGroup page.
 *
 * The group is named by an off-screen element rather than by `label`, which
 * would render a heading above a single row. Not left unnamed: the contract
 * calls an unnamed radiogroup a mistake, and pointing labelledBy at an id that
 * does not exist would be worse than either.
 *
 * A component rather than an inline render, because it needs useId and useState
 * — a hook written straight into an EXAMPLES or INTERACTIVE entry would join
 * the hook list of whatever is rendering it and change its length on navigation.
 */
/**
 * A single row, shown the only way a row can be shown: inside a menu.
 *
 * `MenuItem` throws outside a `Menu` on purpose — alone it has no list to
 * navigate and no trigger to return focus to — so the page for it stages one
 * rather than leaving the preview empty. Same reason `RadioStage` exists below.
 *
 * It starts CLOSED, which is not a stylistic choice: the menu is a
 * `popover="auto"`, and the platform allows exactly one of those open at a
 * time. Three stages on one page each opening on mount meant each evicted the
 * one before it, so two cards showed a bare trigger and only the last showed
 * a menu. Clicking is the honest way to see it, and it matches `DialogStage`.
 */
/**
 * A modal is only itself when it is open, so the page stages one behind a
 * trigger rather than rendering it flat — `showModal()` is what supplies the
 * focus trap and the inert page, and neither is observable from a screenshot
 * of a dialog that was never opened.
 */
function DialogStage({
  title = "Delete project",
  description,
  size,
  dismissible,
  destructive = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  size?: DialogSize;
  dismissible?: boolean;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open the dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        size={size}
        dismissible={dismissible}
        initialFocus={cancelRef}
        footer={
          <>
            <Button ref={cancelRef} variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant={destructive ? "destructive" : "primary"} onClick={() => setOpen(false)}>
              {destructive ? "Delete" : "Save"}
            </Button>
          </>
        }
      >
        This cannot be undone.
      </Dialog>
    </>
  );
}

/** Filtering over data already on the client, so every keystroke is free. */
/**
 * Manual activation, which is the whole reason that prop exists.
 *
 * The counter makes the difference visible: arrow across the tabs and nothing
 * loads until Enter. Switch the same example to automatic and every tab
 * passed through fires a load — which over a real request is three the reader
 * never asked for.
 */
function TabsManualStage() {
  const [loads, setLoads] = useState<string[]>([]);
  return (
    <div className="pg-block-stack">
      <Tabs
        label="Invoice"
        activation="manual"
        onValueChange={(next) => setLoads((seen) => [...seen, next])}
        items={[
          { value: "details", label: "Details", content: "Loaded on open." },
          { value: "history", label: "History", content: "Loaded on open." },
          { value: "notes", label: "Notes", content: "Loaded on open." },
        ]}
      />
      <p className="pg-search-status">
        {loads.length === 0
          ? "Arrow across the tabs — nothing loads until you press Enter."
          : `Loaded: ${loads.join(", ")}`}
      </p>
    </div>
  );
}

function SearchFilterStage({ size }: { size?: SearchSize }) {
  const rows = ["Acme Ltd", "Borealis", "Cygnus Freight", "Delta Rail"];
  const [query, setQuery] = useState("");
  const shown = rows.filter((r) => r.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="pg-block-stack">
      <Search label="Filter rows" size={size} value={query} onValueChange={setQuery} />
      <ul className="pg-search-results">
        {shown.map((row) => (
          <li key={row}>{row}</li>
        ))}
        {shown.length === 0 && <li className="pg-search-empty">No rows match.</li>}
      </ul>
    </div>
  );
}

/**
 * A committed query that cost something.
 *
 * The live region is the point of the example: `loading` covers the sighted
 * case, and the count — which Search cannot know — covers the other one.
 */
function SearchPendingStage() {
  const [pending, setPending] = useState(false);
  const [found, setFound] = useState<number | null>(null);
  return (
    <div className="pg-block-stack">
      <Search
        label="Search invoices"
        placeholder="Search invoices"
        loading={pending}
        onSearch={(query) => {
          setPending(true);
          setFound(null);
          window.setTimeout(() => {
            setPending(false);
            setFound(query.length * 3);
          }, 1200);
        }}
      />
      <p aria-live="polite" className="pg-search-status">
        {pending ? "" : found === null ? "Press Enter to search." : `${found} found`}
      </p>
    </div>
  );
}

function MenuItemStage({
  children = "Duplicate",
  destructive,
  selected,
  disabled,
  icon = Copy,
}: {
  children?: ReactNode;
  destructive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Menu
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="secondary">Open the menu</Button>}
    >
      <MenuItem
        value="row"
        icon={icon}
        destructive={destructive}
        selected={selected}
        disabled={disabled}
        onSelect={() => {}}
      >
        {children}
      </MenuItem>
    </Menu>
  );
}

function RadioStage({
  label = "Annual",
  description = "Two months free",
  disabled,
}: {
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const [on, setOn] = useState<string | null>("annual");
  const labelId = `${useId()}-group`;
  return (
    <>
      <span id={labelId} className="pg-visually-hidden">
        Billing period
      </span>
      <RadioGroup labelledBy={labelId} value={on} onValueChange={setOn}>
        <Radio value="annual" label={label} description={description} disabled={disabled} />
      </RadioGroup>
    </>
  );
}

/** Controlled, because a setting is state the rest of the page reads. */
function NotificationsExample() {
  const [on, setOn] = useState(true);
  return <Switch label="Notifications" checked={on} onCheckedChange={setOn} />;
}

/**
 * The live-region pattern the contract insists on.
 *
 * The wrapper is always rendered, so the region exists before the notice's text
 * arrives — mounting the region and its content in the same commit is what
 * makes announcements unreliable, and it is invisible in testing unless you are
 * listening. `live` stays off on the Notice for exactly that reason.
 */
function SaveFailureExample() {
  const [failed, setFailed] = useState(true);
  return (
    <div className="pg-block-stack">
      <div aria-live="polite">
        {failed ? (
          <Notice
            variant="danger"
            title="Could not save"
            actions={
              <Button variant="secondary" onClick={() => setFailed(false)}>
                Retry
              </Button>
            }
          >
            The server refused the change.
          </Notice>
        ) : null}
      </div>
      {!failed && (
        <Button variant="secondary" onClick={() => setFailed(true)}>
          Make it fail again
        </Button>
      )}
    </div>
  );
}

/**
 * Dismissal, with the two things Notice deliberately does not do.
 *
 * It does not hide itself — this component owns that — and it does not move
 * focus, so the handler puts focus somewhere deliberate instead of letting it
 * fall to <body> when the close button it was on disappears.
 */
function InvitesExample() {
  const [sent, setSent] = useState(true);
  const afterRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div className="pg-block-stack">
      <div aria-live="polite">
        {sent ? (
          <Notice
            variant="success"
            onDismiss={() => {
              setSent(false);
              afterRef.current?.focus();
            }}
          >
            Invitations sent to 12 people.
          </Notice>
        ) : null}
      </div>
      <Button ref={afterRef} variant="secondary" onClick={() => setSent(true)}>
        {sent ? "Send more" : "Send again"}
      </Button>
    </div>
  );
}

/** A case the contract includes to say "don't" — its notes open with exactly that. */
const isCounterExample = (item: Contract["usage"][number]) =>
  (item.notes ?? "").trimStart().toLowerCase().startsWith("don't");

/**
 * Inline code spans in contract prose.
 *
 * The contracts are written in markdown-ish text — 15 of the 25 usage entries
 * put prop names in backticks — so rendering the string raw leaked the source
 * format onto the page as literal ` characters.
 */
function Prose({ text }: { text: string }) {
  // split() with a capture group alternates literal, captured, literal…
  const parts = text.split(/`([^`]+)`/g);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part))}
    </>
  );
}

function ExampleCard({
  contract,
  item,
  onNavigate,
}: {
  contract: Contract;
  item: Contract["usage"][number];
  onNavigate?: (page: Page, tab: ComponentTab) => void;
}) {
  const counter = isCounterExample(item);
  const render = counter ? undefined : EXAMPLES[contract.name]?.[item.case];

  return (
    <article className={`pg-example${counter ? " pg-example--counter" : ""}`}>
      <div className="pg-example-head">
        <div className="pg-example-titleblock">
          <div className="pg-example-titleline">
            <span className="pg-example-title">
              {contract.title} — {item.case}
            </span>
            {counter && <span className="pg-example-flag">don&rsquo;t</span>}
          </div>

          {/* Both halves of the contract's prose, directly under the title:
              `when` is the situation that selects this pattern and `notes` is
              what to watch out for in it. They used to be split between a
              caption inside the stage and a tab panel below it, which put two
              sentences about one example in two different places. */}
          {item.when && (
            <p className="pg-example-desc">
              <Prose text={item.when} />
            </p>
          )}
          {item.notes && (
            <p className="pg-example-desc">
              <Prose text={item.notes} />
            </p>
          )}
        </div>

        {/* Only for patterns worth trying. Sending someone to the playground to
            reproduce a counter-example would be an odd invitation. */}
        {!counter && onNavigate && (
          <button
            type="button"
            className="pg-example-open"
            onClick={() => onNavigate(componentPage(contract.name), "properties")}
          >
            Open in Playground
          </button>
        )}
      </div>

      <div className="pg-example-stage">
        {render ? (
          <div className="pg-example-render">{render()}</div>
        ) : (
          <p className="pg-note">
            {counter
              ? "Not rendered on purpose — showing it working would be the argument against it."
              : contract.mode === "spec"
                ? "Nothing to render yet — this is the approved API, with no code behind it."
                : contract.mode === "css-only"
                  ? "A class composed onto another component, so there is nothing standalone to show."
                  : "No live specimen for this case."}
          </p>
        )}
      </div>
    </article>
  );
}

// ---- Interactive props ---------------------------------------------------
// The controls below are generated from the contract, not listed here: a union
// prop becomes a select over the members parsed out of its type alias, a
// boolean becomes a checkbox, a string becomes a text box. Add a prop to a
// component and its control appears on the next docs build — there is no
// second list of props in this file to forget to update.
//
// What is hand-written is only how each component renders with a bag of props,
// which no contract can supply.

type DemoState = Record<string, string | boolean>;

interface Interactive {
  /** Contract prop names the controls may drive, in the order they are shown. */
  controls: string[];
  /** Editable children, for components that take them. Not a prop, so not in the contract. */
  slot?: { label: string; initial: string };
  /**
   * How the component renders for a bag of props. `set` is handed in for
   * components that own state the user is supposed to change by using them —
   * a toggle whose demo cannot be toggled is the mocked-up control this file
   * exists to avoid, so the demo writes back to the same state the controls
   * read.
   */
  render: (state: DemoState, set: (patch: DemoState) => void) => ReactNode;
  /**
   * Props the snippet must show that no control drives — the obligations a
   * contract puts on the caller, like the `aria-label` `iconOnly` requires.
   */
  implied?: (state: DemoState) => Record<string, string>;
}

const iconLabel = (state: DemoState) => String(state.children || "Settings");

const INTERACTIVE: Record<string, Interactive> = {
  radio: {
    // `value` is not a control: it is the option's identity, not a setting to
    // try. Everything a Radio itself decides is here.
    controls: ["label", "description", "disabled"],
    render: (state) => (
      <RadioStage
        label={String(state.label || "Annual")}
        description={state.description ? String(state.description) : undefined}
        disabled={Boolean(state.disabled)}
      />
    ),
  },
  switch: {
    controls: ["label", "labelHidden", "description", "checked", "disabled"],
    render: (state, set) => (
      <Switch
        label={String(state.label || "Notifications")}
        labelHidden={Boolean(state.labelHidden)}
        description={state.description ? String(state.description) : undefined}
        checked={Boolean(state.checked)}
        disabled={Boolean(state.disabled)}
        onCheckedChange={(next) => set({ checked: next })}
      />
    ),
  },
  checkbox: {
    controls: ["label", "description", "checked", "indeterminate", "disabled", "required"],
    render: (state, set) => (
      <Checkbox
        label={String(state.label || "Email me product updates")}
        description={state.description ? String(state.description) : undefined}
        checked={Boolean(state.checked)}
        indeterminate={Boolean(state.indeterminate)}
        disabled={Boolean(state.disabled)}
        required={Boolean(state.required)}
        onCheckedChange={(next) => set({ checked: next, indeterminate: false })}
      />
    ),
  },

  "radio-group": {
    controls: ["label", "orientation", "disabled", "required"],
    render: (state) => (
      <RadioGroup
        label={String(state.label || "Billing period")}
        orientation={state.orientation as ButtonGroupOrientation}
        disabled={Boolean(state.disabled)}
        required={Boolean(state.required)}
        defaultValue="annual"
      >
        <Radio value="monthly" label="Monthly" />
        <Radio value="annual" label="Annual" />
      </RadioGroup>
    ),
  },

  badge: {
    controls: ["variant", "dot"],
    slot: { label: "Children", initial: "Passing" },
    render: (state) => (
      <Badge variant={state.variant as BadgeVariant} dot={Boolean(state.dot)}>
        {String(state.children)}
      </Badge>
    ),
  },

  avatar: {
    controls: ["name", "size", "decorative"],
    render: (state) => (
      <Avatar
        name={String(state.name || "Ada Hartley")}
        size={state.size as AvatarSize}
        decorative={Boolean(state.decorative)}
      />
    ),
  },

  "mobile-nav": {
    controls: ["title", "label", "triggerLabel"],
    render: (state) => (
      <MobileNav
        title={String(state.title || "Menu")}
        label={String(state.label || "Main")}
        triggerLabel={String(state.triggerLabel || "Menu")}
        sections={[
          {
            items: [
              { label: "Invoices", href: "#", current: true },
              { label: "Clients", href: "#" },
            ],
          },
        ]}
      />
    ),
  },

  "side-nav": {
    controls: ["label"],
    render: (state) => (
      <SideNav
        className="pg-rail"
        label={String(state.label || "Sections")}
        sections={[
          {
            label: "Billing",
            items: [
              { label: "Invoices", href: "#", current: true },
              { label: "Credit notes", href: "#" },
            ],
          },
          { label: "Setup", items: [{ label: "Tax rates", href: "#" }] },
        ]}
      />
    ),
  },

  tabs: {
    controls: ["label", "variant", "orientation", "activation"],
    render: (state) => (
      <Tabs
        label={String(state.label || "Invoice")}
        variant={state.variant as TabsVariant}
        orientation={state.orientation as TabsOrientation}
        activation={state.activation as TabsActivation}
        items={[
          { value: "details", label: "Details", content: "Amount, dates, and the client." },
          { value: "history", label: "History", content: "Every change, most recent first." },
          { value: "notes", label: "Notes", content: "Anything the team wrote down." },
        ]}
      />
    ),
  },

  "top-nav": {
    controls: ["label"],
    render: (state) => (
      <TopNav
        label={String(state.label || "Main")}
        brand={<strong className="pg-brand">Ratā</strong>}
        items={[
          { label: "Invoices", href: "#", current: true },
          { label: "Clients", href: "#" },
          { label: "Reports", href: "#" },
        ]}
        actions={<Button variant="secondary">New invoice</Button>}
      />
    ),
  },

  search: {
    controls: ["label", "labelHidden", "placeholder", "size", "loading", "landmark", "disabled"],
    render: (state) => (
      <Search
        label={String(state.label || "Search")}
        labelHidden={state.labelHidden === undefined ? true : Boolean(state.labelHidden)}
        placeholder={state.placeholder ? String(state.placeholder) : undefined}
        size={state.size as SearchSize}
        loading={Boolean(state.loading)}
        landmark={Boolean(state.landmark)}
        disabled={Boolean(state.disabled)}
      />
    ),
  },

  dialog: {
    controls: ["title", "description", "size", "dismissible"],
    render: (state) => (
      <DialogStage
        title={String(state.title || "Delete project")}
        description={state.description ? String(state.description) : undefined}
        size={state.size as DialogSize}
        dismissible={state.dismissible === undefined ? true : Boolean(state.dismissible)}
      />
    ),
  },

  "menu-item": {
    controls: ["destructive", "selected", "disabled"],
    slot: { label: "Children", initial: "Duplicate" },
    render: (state) => (
      <MenuItemStage
        destructive={Boolean(state.destructive)}
        selected={Boolean(state.selected)}
        disabled={Boolean(state.disabled)}
      >
        {String(state.children)}
      </MenuItemStage>
    ),
  },

  menu: {
    controls: ["label"],
    render: (state) => (
      <Menu
        label={state.label ? String(state.label) : undefined}
        trigger={<Button variant="secondary">Actions</Button>}
      >
        <MenuItem icon={Copy} onSelect={() => {}}>Duplicate</MenuItem>
        <MenuItem icon={Download} onSelect={() => {}}>Download</MenuItem>
        <MenuSeparator />
        <MenuItem destructive icon={Trash2} onSelect={() => {}}>Delete</MenuItem>
      </Menu>
    ),
  },

  notice: {
    controls: ["variant", "live", "title"],
    slot: { label: "Children", initial: "This project is read-only while the migration runs." },
    render: (state) => (
      <Notice
        variant={state.variant as NoticeVariant}
        live={state.live as NoticeLive}
        title={state.title ? String(state.title) : undefined}
      >
        {String(state.children)}
      </Notice>
    ),
  },

  breadcrumbs: {
    controls: ["label", "separator"],
    render: (state) => (
      <Breadcrumbs
        label={String(state.label || "Breadcrumb")}
        separator={state.separator ? String(state.separator) : undefined}
        items={[
          { label: "Home", href: "#" },
          { label: "Reports", href: "#" },
          { label: "Q3 revenue" },
        ]}
      />
    ),
  },
  "text-field": {
    controls: ["label", "labelHidden", "size", "status", "description", "message", "disabled", "required"],
    render: (state) => (
      <TextField className="pg-field"
        label={String(state.label || "Email")}
        labelHidden={Boolean(state.labelHidden)}
        size={state.size as TextFieldSize}
        status={state.status as TextFieldStatus}
        description={state.description ? String(state.description) : undefined}
        message={state.message ? String(state.message) : undefined}
        disabled={Boolean(state.disabled)}
        required={Boolean(state.required)}
        placeholder="name@example.com"
      />
    ),
  },
  "toggle-button-group": {
    controls: ["label", "selectionMode", "orientation", "size", "attached", "deselectable", "disabled"],
    render: (state) => (
      <ToggleButtonGroup
        label={String(state.label || "Text alignment")}
        selectionMode={state.selectionMode as ToggleButtonGroupSelectionMode}
        orientation={state.orientation as ButtonGroupOrientation}
        size={state.size as ToggleButtonSize}
        attached={state.attached !== false}
        deselectable={Boolean(state.deselectable)}
        disabled={Boolean(state.disabled)}
        defaultValue={state.selectionMode === "multiple" ? ["left"] : "left"}
      >
        <ToggleButton value="left">Left</ToggleButton>
        <ToggleButton value="center">Center</ToggleButton>
        <ToggleButton value="right">Right</ToggleButton>
      </ToggleButtonGroup>
    ),
  },
  button: {
    controls: ["variant", "size", "disabled", "loading", "iconOnly"],
    slot: { label: "Children", initial: "Save changes" },
    implied: (state): Record<string, string> =>
      state.iconOnly ? { "aria-label": iconLabel(state) } : {},
    render: (state) => (
      <Button
        variant={state.variant as ButtonVariant}
        size={state.size as ButtonSize}
        disabled={Boolean(state.disabled)}
        loading={Boolean(state.loading)}
        iconOnly={Boolean(state.iconOnly)}
        aria-label={state.iconOnly ? iconLabel(state) : undefined}
      >
        {state.iconOnly ? <Icon icon={Settings} /> : String(state.children)}
      </Button>
    ),
  },
  "button-group": {
    controls: ["label", "orientation", "attached"],
    render: (state) => (
      <ButtonGroup
        label={String(state.label || "Form actions")}
        orientation={state.orientation as ButtonGroupOrientation}
        attached={Boolean(state.attached)}
      >
        <Button variant="secondary">Cancel</Button>
        <Button variant="secondary">Save draft</Button>
        <Button>Publish</Button>
      </ButtonGroup>
    ),
  },
  "toggle-button": {
    controls: ["variant", "size", "pressed", "disabled", "loading", "iconOnly"],
    slot: { label: "Children", initial: "Bold" },
    implied: (state): Record<string, string> =>
      state.iconOnly ? { "aria-label": iconLabel(state) } : {},
    render: (state, set) => (
      <ToggleButton
        variant={state.variant as ToggleButtonVariant}
        size={state.size as ToggleButtonSize}
        pressed={Boolean(state.pressed)}
        disabled={Boolean(state.disabled)}
        loading={Boolean(state.loading)}
        iconOnly={Boolean(state.iconOnly)}
        aria-label={state.iconOnly ? iconLabel(state) : undefined}
        // Writes back to the state the `pressed` checkbox reads, so using the
        // demo and driving it from the controls stay in agreement.
        onPressedChange={(next) => set({ pressed: next })}
      >
        {state.iconOnly ? <Icon icon={Bold} /> : String(state.children)}
      </ToggleButton>
    ),
  },
  icon: {
    // `icon` itself is not a control: the value is a component, not something a
    // select can offer. Settings stands in so the size steps are comparable.
    controls: ["size", "label"],
    render: (state) => (
      <Icon
        icon={Settings}
        size={(state.size as IconSize) || "md"}
        label={state.label ? String(state.label) : undefined}
      />
    ),
  },
  spinner: {
    controls: ["label"],
    render: (state) => <Spinner label={state.label ? String(state.label) : undefined} />,
  },
};

/** A contract default is source text (`"primary"`, `true`) — this is the value it means. */
function initialValue(prop: ContractProp): string | boolean {
  const raw = prop.default;
  if (raw === undefined || raw === null) return prop.type === "boolean" ? false : "";
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw.replace(/^"|"$/g, "");
}

function initialState(contract: Contract, spec: Interactive): DemoState {
  const state: DemoState = {};
  for (const name of spec.controls) {
    const prop = contract.props.find((p) => p.name === name);
    if (prop) state[name] = initialValue(prop);
  }
  if (spec.slot) state.children = spec.slot.initial;
  return state;
}

/** The JSX for what is currently on screen: props that differ from their default, and nothing else. */
function snippet(contract: Contract, spec: Interactive, state: DemoState): string {
  const tag = contract.title.replace(/[^A-Za-z]/g, "");
  const attrs: string[] = [];

  for (const name of spec.controls) {
    const prop = contract.props.find((p) => p.name === name);
    if (!prop) continue;
    const value = state[name];
    if (value === initialValue(prop)) continue; // it is the default — writing it adds noise, not information
    if (typeof value === "boolean") {
      if (value) attrs.push(name);
    } else if (value !== "") {
      attrs.push(`${name}="${value}"`);
    }
  }

  for (const [name, value] of Object.entries(spec.implied?.(state) ?? {})) {
    attrs.push(`${name}="${value}"`);
  }

  const open = `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
  if (!spec.slot) return `${open} />`;
  const children = state.iconOnly ? "<Icon icon={Settings} />" : String(state.children);
  return `${open}>${children}</${tag}>`;
}

/**
 * Conflicts the contract declares, checked against what is currently set. The
 * component will not stop you — `loading` and `disabled` both compile — so
 * saying it here is the only place the rule shows up while you are exploring.
 */
function activeConflicts(contract: Contract, state: DemoState): string[] {
  const warnings: string[] = [];
  for (const prop of contract.props) {
    if (!state[prop.name]) continue;
    for (const other of prop.conflicts) {
      if (state[other] && prop.name < other) warnings.push(`${prop.name} and ${other}`);
    }
  }
  return warnings;
}

/**
 * The control for one prop. Its accessible name is the prop name, which the row
 * already shows in its first column — a second visible copy beside the input
 * would be the same word twice, so this labels without repeating.
 */
/**
 * A prop's control, built from the system's own components.
 *
 * These were a native `<select>`, `<input type="checkbox">` and text input —
 * written before the system had a Checkbox, a RadioGroup or a TextField to use.
 * A documentation tool that styles its own form controls by hand is the least
 * convincing possible argument for the components it is documenting.
 *
 * Unions become a vertical RadioGroup rather than a segmented
 * ToggleButtonGroup: the control column is 220px, and five attached options
 * (badge's variant, icon's size) need closer to 370px. A group that overflows
 * its column is worse than one that is tall.
 *
 * The group takes `labelledBy` rather than `label`, pointing at the prop name
 * already rendered in the row's first column — which is precisely what that
 * prop is documented for, and it avoids naming the same thing twice on screen.
 */
function Control({
  prop,
  value,
  onChange,
  labelledBy,
}: {
  prop: ContractProp;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  labelledBy: string;
}) {
  if (prop.values?.length) {
    return (
      <RadioGroup
        labelledBy={labelledBy}
        value={String(value)}
        onValueChange={onChange}
      >
        {prop.values.map((option) => (
          <Radio key={option} value={option} label={option} />
        ))}
      </RadioGroup>
    );
  }

  if (prop.type === "boolean") {
    // The prop name is already the row's first column, so the label is hidden
    // rather than repeated — the same reason the union control above takes
    // `labelledBy`. Hidden, not dropped: the box keeps its accessible name.
    return (
      <Checkbox
        label={prop.name}
        labelHidden
        checked={Boolean(value)}
        onCheckedChange={(next) => onChange(next)}
      />
    );
  }

  return (
    <TextField
      label={prop.name}
      labelHidden
      size="sm"
      placeholder="value"
      value={String(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * The preview stage: the component as currently configured, with its JSX one
 * click away. The code is folded by default because the thing being documented
 * is the component, not the snippet — but it is one toggle away because the
 * snippet is what you actually leave with.
 */
function PropsStage({
  contract,
  spec,
  state,
  set,
}: {
  contract: Contract;
  spec: Interactive;
  state: DemoState;
  set: (patch: DemoState) => void;
}) {
  const [showCode, setShowCode] = useState(false);
  const conflicts = activeConflicts(contract, state);

  return (
    <div className="pg-stage">
      <div className="pg-stage-canvas">
        <button
          type="button"
          className="pg-stage-code-toggle rata-state-layer rata-state-layer--flush"
          aria-expanded={showCode}
          aria-label={showCode ? "Hide JSX" : "Show JSX"}
          onClick={() => setShowCode((open) => !open)}
        >
          &lt;/&gt;
        </button>
        {spec.render(state, set)}
      </div>

      {showCode && <pre className="pg-code pg-stage-code">{snippet(contract, spec, state)}</pre>}

      {conflicts.length > 0 && (
        <p className="pg-callout pg-callout--conflict">
          <strong>Conflicting props:</strong> {conflicts.join("; ")}. The contract says never to pass
          both — the component compiles either way, which is why it is worth saying here.
        </p>
      )}
    </div>
  );
}

/** A union type, listed the way you would choose from it rather than the way it is declared. */
function TypeSignature({ prop }: { prop: ContractProp }) {
  const defaultValue = prop.default?.replace(/^"|"$/g, "");
  if (!prop.values?.length) return <code className="pg-prop-type">{prop.type}</code>;
  return (
    <code className="pg-prop-type">
      {prop.values.map((value) => (
        <span className="pg-prop-type-line" key={value}>
          | &apos;{value}&apos;
          {value === defaultValue && <span className="pg-prop-default"> (default)</span>}
        </span>
      ))}
    </code>
  );
}

/**
 * One prop: what it is called, what it accepts, what it is for, and — when the
 * component is implemented — the control that sets it on the preview above.
 * The three used to be a table, a set of cards and a separate playground; they
 * are one row because they are one question.
 */
function PropRow({
  prop,
  value,
  onChange,
}: {
  prop: ContractProp;
  value?: string | boolean;
  onChange?: (value: string | boolean) => void;
}) {
  const guidance = prop.use.length + prop.dont.length + prop.conflicts.length > 0;
  // The name in column one is what names the control in column three, so the
  // control never repeats it.
  const nameId = `${useId()}-name`;

  return (
    <div className="pg-prop-row">
      <div className="pg-prop-name">
        <code id={nameId}>{prop.name}</code>
      </div>

      <div className="pg-prop-detail">
        <TypeSignature prop={prop} />
        {(prop.summary || prop.description) && (
          <p className="pg-prop-summary">{prop.summary ?? prop.description}</p>
        )}
        {prop.description && prop.summary && prop.description !== prop.summary && (
          <p className="pg-note">Source doc: {prop.description}</p>
        )}

        {guidance && (
          <details className="pg-prop-guidance">
            <summary>When to use it, and when not to</summary>
            {prop.use.length > 0 && (
              <section className="pg-doc-block">
                <h4>Use when</h4>
                <ul>
                  {prop.use.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {prop.dont.length > 0 && (
              <section className="pg-doc-block pg-doc-block--dont">
                <h4>Don&rsquo;t use for</h4>
                <ul>
                  {prop.dont.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {prop.conflicts.length > 0 && (
              <p className="pg-note">
                Conflicts with{" "}
                {prop.conflicts.map((other, i) => (
                  <span key={other}>
                    {i > 0 ? ", " : ""}
                    <code>{other}</code>
                  </span>
                ))}{" "}
                — never pass both.
              </p>
            )}
          </details>
        )}

        {prop.a11y && (
          <p className="pg-note">Carries an accessibility obligation — see the Accessibility tab.</p>
        )}
      </div>

      <div className="pg-prop-control">
        {onChange && (
          <Control prop={prop} value={value ?? ""} onChange={onChange} labelledBy={nameId} />
        )}
      </div>
    </div>
  );
}

function PropSignature({ prop }: { prop: ContractProp }) {
  const def = prop.default !== undefined && prop.default !== null ? ` = ${prop.default}` : "";
  return (
    <code className="pg-prop-signature">
      {prop.name}
      {prop.optional ? "?" : ""}: {prop.type}
      {def}
    </code>
  );
}

/**
 * The mode banner. `spec` and `css-only` are not degraded states — they are
 * two of the three legitimate answers to "what is this component", and saying
 * which one applies is what stops someone importing a `<Dialog>` that has no
 * code behind it.
 */
function ModeNote({ contract }: { contract: Contract }) {
  if (contract.mode === "documented") {
    return (
      <pre className="pg-code">{`import { ${contract.title.replace(/[^A-Za-z]/g, "")} } from "${contract.importPath}";`}</pre>
    );
  }
  if (contract.mode === "css-only") {
    return (
      <p className="pg-callout">
        <strong>CSS-only.</strong> There is no React component to import — this is a class composed
        onto other components&rsquo; own.
      </p>
    );
  }
  return (
    <p className="pg-callout pg-callout--spec">
      <strong>Not implemented yet.</strong> This page is the <em>approved intent</em> — the props
      API signed off at gate 1 of the build order, before any React exists. Don&rsquo;t import it;
      there is nothing to import.
    </p>
  );
}

/**
 * One component, three tabs, three addresses:
 *
 *   /components/button                      what it is and how it looks
 *   /components/button?tab=properties       every prop and what each is for
 *   /components/button?tab=accessibility    what it obliges the caller to do
 *
 * The tabs are `<a href>`s rather than an ARIA tab widget, because they change
 * the URL: they are navigation, and rendering navigation as a tablist takes
 * away middle-click, cmd-click and "copy link address" in exchange for nothing.
 *
 * The split is by question, not by field. Accessibility is not a footnote at
 * the bottom of the props table here — `iconOnly` without an `aria-label` and
 * a natively-`disabled` control are the two failures this system is built to
 * prevent, so what a prop obliges you to do gets a page, not a line.
 */
function ComponentTabs({
  contract,
  tab,
  onNavigate,
}: {
  contract: Contract;
  tab: ComponentTab;
  onNavigate: (page: Page, tab: ComponentTab) => void;
}) {
  return (
    <nav className="pg-tabs" aria-label={`${contract.title} sections`}>
      {COMPONENT_TABS.map((item) => (
        <a
          key={item.id}
          className={`pg-tab${item.id === tab ? " is-active" : ""}`}
          href={hrefFor(componentPage(contract.name), item.id)}
          aria-current={item.id === tab ? "page" : undefined}
          onClick={(event) => {
            // Let the browser handle the modified clicks it handles better:
            // new tab, new window, download, and any non-primary button.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
              return;
            }
            event.preventDefault();
            onNavigate(componentPage(contract.name), item.id);
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

/**
 * One live specimen. It owns its own state rather than taking a frozen bag of
 * props, so a toggle in the variants grid is still a toggle you can press —
 * the same reason the interactive stage is handed a setter.
 */
function Specimen({ spec, initial }: { spec: Interactive; initial: DemoState }) {
  const [state, setState] = useState<DemoState>(initial);
  return (
    <div className="pg-showcase-item">
      {spec.render(state, (patch) => setState((prev) => ({ ...prev, ...patch })))}
    </div>
  );
}

function OverviewTab({
  contract,
  onNavigate,
}: {
  contract: Contract;
  onNavigate?: (page: Page, tab: ComponentTab) => void;
}) {
  const demo = DEMOS[contract.name];
  const spec = INTERACTIVE[contract.name];
  const base = spec ? initialState(contract, spec) : null;

  // The showcase's axis: `variant` when the component has one, otherwise its
  // first union prop, taken from the contract in its own order. Per-prop
  // breakdowns used to live on this tab too and were dropped — the Properties
  // tab already lists every prop against its contract, so repeating variant,
  // size and the boolean states here was three views of one thing.
  const driven = (prop: ContractProp) => spec?.controls.includes(prop.name) ?? false;
  const unionProps = contract.props.filter((p) => driven(p) && (p.values?.length ?? 0) > 1);
  const showcaseProp = unionProps.find((p) => p.name === "variant") ?? unionProps[0];
  const showcaseValues = showcaseProp?.values ?? [];

  return (
    <>
      <section className="pg-section">
        <ModeNote contract={contract} />
      </section>

      {spec && base && (
        <section className="pg-section">
          {/* The showcase: one panel, the whole set of the component's headline
              variants side by side at their default size. It answers "what is
              this" in one look, before any of the guidance below breaks it
              down. The component's description and status already sit in the
              page head, so nothing is repeated here — the panel is only the
              specimens. */}
          <div className="pg-showcase">
            {showcaseValues.length > 1 ? (
              showcaseValues.map((value) => (
                <Specimen
                  key={value}
                  spec={spec}
                  initial={{ ...base, [showcaseProp!.name]: value }}
                />
              ))
            ) : (
              <Specimen spec={spec} initial={base} />
            )}
          </div>
        </section>
      )}

      {!spec && demo && (
        <section className="pg-section">
          <h3>Live</h3>
          {demo()}
        </section>
      )}

      {!demo && !spec && contract.mode === "spec" && (
        <section className="pg-section">
          <h3>Live</h3>
          <p className="pg-note">
            Nothing to render — this page is the spec, not a description of shipped code.
          </p>
        </section>
      )}

      {contract.usage.length > 0 && (
        <section className="pg-section">
          <h3>Examples</h3>
          <p className="pg-section-lede">Common configurations, variations, and states.</p>
          <div className="pg-examples">
            {contract.usage.map((item) => (
              <ExampleCard
                key={item.case}
                contract={contract}
                item={item}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>
      )}

      {contract.example && (
        <section className="pg-section">
          <h3>Real usage in this repo</h3>
          <p className="pg-note">
            Extracted from <code>apps/</code> — a snippet someone actually shipped, not a synthesized
            one.
          </p>
          <pre className="pg-code">{contract.example}</pre>
        </section>
      )}

      {Object.keys(contract.tokens).length > 0 && (
        <section className="pg-section">
          <h3>Token recipe</h3>
          <p className="pg-note">
            The exact token for every property — including for components not built yet, where the
            recipe is the spec.
          </p>
          {Object.entries(contract.tokens).map(([variant, recipe]) => (
            <div className="pg-recipe" key={variant}>
              <div className="pg-ramp-title">{variant}</div>
              {recipe.summary && <p className="pg-note">{recipe.summary}</p>}
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Token</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(recipe.tokens ?? {}).map(([property, token]) => (
                    <tr key={property}>
                      <td>{property}</td>
                      <td>
                        <code>{token}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function PropertiesTab({ contract }: { contract: Contract }) {
  const spec = INTERACTIVE[contract.name];
  const [state, setState] = useState<DemoState>(() =>
    spec ? initialState(contract, spec) : {}
  );

  if (contract.mode === "css-only") {
    return (
      <section className="pg-section">
        <p className="pg-callout">
          <strong>No props API by design.</strong> {contract.title} is a class you compose onto
          another component&rsquo;s own — see the Overview tab for how.
        </p>
      </section>
    );
  }

  if (contract.props.length === 0) {
    return (
      <section className="pg-section">
        <p className="pg-callout pg-callout--spec">
          <strong>No props approved yet.</strong> {contract.title} has a token recipe but no props
          API — gate 1 of the build order hasn&rsquo;t been passed, so there is nothing to look up
          and nothing to invent.
        </p>
      </section>
    );
  }

  const set = (name: string) => (value: string | boolean) =>
    setState((prev) => ({ ...prev, [name]: value }));
  const controllable = (prop: ContractProp) => spec?.controls.includes(prop.name) ?? false;

  const required = contract.props.filter((prop) => !prop.optional);
  const optional = contract.props.filter((prop) => prop.optional);

  const rows = (props: ContractProp[]) =>
    props.map((prop) => (
      <PropRow
        key={prop.name}
        prop={prop}
        value={state[prop.name]}
        onChange={controllable(prop) ? set(prop.name) : undefined}
      />
    ));

  return (
    <>
      {spec && (
        <section className="pg-section">
          <PropsStage
            contract={contract}
            spec={spec}
            state={state}
            set={(patch) => setState((prev) => ({ ...prev, ...patch }))}
          />
        </section>
      )}

      <section className="pg-section">
        <h3>Props</h3>
        <p className="pg-note">
          Names, types and defaults are read from{" "}
          <code>packages/react/src/{contract.name}.tsx</code>; what each one is for is written in{" "}
          <code>registry/components/{contract.name}.json</code>. The build fails if the two
          disagree.
          {contract.extends && (
            <>
              {" "}
              Extends <code>{contract.extends}</code>.
            </>
          )}
        </p>

        {/* With no implementation behind it there is nothing for a control to
            drive, so the row drops to two columns rather than reserving a
            column of empty boxes. */}
        <div className={`pg-props${spec ? "" : " pg-props--static"}`}>
          {required.length > 0 && (
            <>
              <div className="pg-props-group">Required</div>
              {rows(required)}
            </>
          )}

          {optional.length > 0 && (
            <>
              <div className="pg-props-group">Optional</div>
              {rows(optional)}
            </>
          )}

          {spec?.slot && (
            <>
              <div className="pg-props-group">Inherited</div>
              <div className="pg-prop-row">
                <div className="pg-prop-name">
                  <code>children</code>
                </div>
                <div className="pg-prop-detail">
                  <code className="pg-prop-type">ReactNode</code>
                  <p className="pg-prop-summary">
                    The button&rsquo;s visible label. Comes from the extended element props, not from{" "}
                    {contract.title}&rsquo;s own interface, which is why it has no contract entry of
                    its own.
                  </p>
                </div>
                <div className="pg-prop-control">
                  <TextField
                    label="children"
                    labelHidden
                    size="sm"
                    placeholder="value"
                    value={String(state.children ?? "")}
                    onChange={(event) => set("children")(event.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function AccessibilityTab({ contract }: { contract: Contract }) {
  const obligations = contract.props.filter((prop) => prop.a11y);
  const decisions = contract.behavior?.decisions ?? [];
  const nothing = obligations.length === 0 && decisions.length === 0 && !contract.behavior;

  return (
    <>
      {nothing && (
        <section className="pg-section">
          <p className="pg-callout pg-callout--spec">
            <strong>Nothing documented yet.</strong> {contract.title} has no behavior contract and no
            per-prop accessibility notes — which for an unbuilt component means the obligations
            haven&rsquo;t been decided, not that there are none.
          </p>
        </section>
      )}

      {obligations.length > 0 && (
        <section className="pg-section">
          <h3>What each prop obliges you to do</h3>
          <p className="pg-note">
            None of this is recoverable from a type signature — which is exactly why it is written
            down: <code>iconOnly</code> compiles without an <code>aria-label</code>.
          </p>
          {obligations.map((prop) => (
            <div className="pg-prop" key={prop.name}>
              <div className="pg-prop-head">
                <h4>{prop.name}</h4>
                <PropSignature prop={prop} />
              </div>
              <p className="pg-prop-summary">{prop.a11y}</p>
            </div>
          ))}
        </section>
      )}

      {contract.behavior && (
        <section className="pg-section">
          <h3>Behavior</h3>
          <p className="pg-note">
            Behavior lives on this tab because in this system the primitive is where the
            accessibility contract is enforced — activation guarding and disabled/busy semantics,
            independent of React and of any styling.
          </p>
          {contract.behavior.summary && <p>{contract.behavior.summary}</p>}
          {contract.behavior.primitive && (
            <p className="pg-note">
              Headless contract: <code>{contract.behavior.primitive}</code> in{" "}
              <code>packages/primitives/src/{contract.name}.ts</code> — importable from{" "}
              <code>@rata/primitives</code> without the React wrapper or any CSS.
            </p>
          )}
          {decisions.map((decision) => (
            <div className="pg-doc-block" key={decision.decision}>
              <h4>{decision.decision}</h4>
              <p>{decision.why}</p>
            </div>
          ))}
        </section>
      )}

      <section className="pg-section">
        <h3>System-wide, and not optional</h3>
        <ul className="pg-rules">
          <li>
            Focus is <code>theme.focus-ring</code> at <code>focus.ring-width</code> with{" "}
            <code>focus.ring-offset</code>, on <code>:focus-visible</code>. Never removed, and never
            offset <code>0</code> on a filled accent control.
          </li>
          <li>
            Disabled controls stay focusable and announced: <code>aria-disabled</code> plus a click
            guard in the primitive, never the native <code>disabled</code> attribute.
          </li>
          <li>
            Colour alone never carries a state — a status ring is always paired with a message.
          </li>
        </ul>
      </section>
    </>
  );
}

export function ComponentPage({
  contract,
  tab,
  onNavigate,
}: {
  contract: Contract;
  tab: ComponentTab;
  onNavigate: (page: Page, tab: ComponentTab) => void;
}) {
  return (
    <>
      <section className="pg-section pg-section--head">
        <div className="pg-component-head">
          <h2>{contract.title}</h2>
          <div className="pg-component-status">
            <StatusPill artifact={contract.status.css} />
            <StatusPill artifact={contract.status.react} />
            <StatusPill artifact={contract.status.figma} />
          </div>
        </div>
        <p className="pg-component-description">{contract.description}</p>
        <p className="pg-note">
          <code>{contract.name}</code> · {contract.family} · {contract.tier} tier
          {contract.dependencies.length > 0 && <> · depends on {contract.dependencies.join(", ")}</>}
        </p>
        <ComponentTabs contract={contract} tab={tab} onNavigate={onNavigate} />
      </section>

      {tab === "overview" && <OverviewTab contract={contract} onNavigate={onNavigate} />}
      {tab === "properties" && <PropertiesTab contract={contract} />}
      {tab === "accessibility" && <AccessibilityTab contract={contract} />}
    </>
  );
}

/** The index page: every component, its family, and where each artifact stands. */
export function ComponentIndex({ onOpen }: { onOpen: (name: string) => void }) {
  return (
    <section className="pg-section">
      <h2>Components</h2>
      <p className="pg-note">
        Every component in the registry, built or not. Open one for its contract — what each prop is
        for, what it conflicts with, and the token recipe behind it.
      </p>
      <table className="pg-table">
        <thead>
          <tr>
            <th>Component</th>
            <th>Family</th>
            <th>CSS</th>
            <th>React</th>
            <th>Figma</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.name}>
              <td>
                <button type="button" className="pg-link" onClick={() => onOpen(contract.name)}>
                  {contract.title}
                </button>
              </td>
              <td>{contract.family}</td>
              <td>
                <StatusPill artifact={contract.status.css} />
              </td>
              <td>
                <StatusPill artifact={contract.status.react} />
              </td>
              <td>
                <StatusPill artifact={contract.status.figma} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
