import type { ClientSettings } from "~/common/types";

interface MigrationKey {
	key: string;
	updates: Migration<MigrationType>[];
}

type MigrationType =
	| "create"
	| "remove"
	| "options-add"
	| "options-remove"
	| "options-rename"
	| "arr-options-remove"
	| "arr-options-rename"
	| "set-value";
interface Migration<T extends MigrationType> {
	type: T;
}

interface CreateMigration extends Migration<"create"> {
	type: "create";
	value: NonNullable<any>;
}
interface RemoveMigration extends Migration<"remove"> {}

interface OptionsAddDefaultMigration extends Migration<"options-add"> {
	value: NonNullable<any>;
}

interface OptionsRemoveMigration extends Migration<"options-remove"> {
	options: {
		value: NonNullable<any>;
		convert_to?: NonNullable<any>;
	}[];
	/**
	 * The value to which the default should switch
	 */
	new_default?: string;
}

interface OptionRenameMigration extends Migration<"options-rename"> {
	options: {
		oldValue: NonNullable<any>;
		value: NonNullable<any>;
	}[];
	/**
	 * Whether to rename the current value of the item
	 */
	rename_stored_value?: boolean;
}

interface ArrOptionsRemoveMigration extends Migration<"arr-options-remove"> {
	options: {
		value: NonNullable<any>;
		convert_to?: NonNullable<any>;
	}[];
}

interface ArrOptionsRenameMigration extends Migration<"arr-options-rename"> {
	options: {
		oldValue: NonNullable<any>;
		value: NonNullable<any>;
	}[];
}

interface SetValueMigration extends Migration<"set-value"> {
	value?: any;
}

interface SettingsMigration {
	version: number;
	migrations: MigrationKey[];
}
const SETTINGS_MIGRATIONS: SettingsMigration[] = [
	{ version: 2, migrations: [{ key: "shouldAttemptSessionRecovery", updates: [{ type: "create", value: true } as CreateMigration] }] },
	{ version: 3, migrations: [{ key: "saveLyrics", updates: [{ type: "create", value: true } as CreateMigration] }] },
	{ version: 4, migrations: [{ key: "audioBitrate", updates: [{ type: "set-value", value: 0 } as SetValueMigration] }] }
];

export function migrateSettings(currentVersion: number, nextVersion: number, settings: ClientSettings) {
	if (currentVersion >= nextVersion) return settings;
	const failureNotification = {
		title: "Failed to migrate settings",
		description: `Migration to version ${nextVersion} failed. The settings have been regenerated.`
	};
	for (let i = currentVersion + 1; i < nextVersion + 1; i++) {
		const migrations = SETTINGS_MIGRATIONS.find((value) => value.version === i);
		if (!migrations) {
			addNotification(failureNotification);
			return createSettings();
		}
		try {
			settings = { ...applyMigrations<ClientSettings>(settings, migrations.migrations), version: i };
		} catch (error) {
			addNotification(failureNotification);
			return createSettings();
		}
	}
	addNotification({ title: "Settings have been migrated", description: `Migrated from version ${currentVersion} to ${nextVersion}` });
	console.log("Just migrated settings from version", currentVersion, "to", nextVersion);
	return settings;
}

function applyMigrations<T extends { [key: string]: any }>(data: T, keys: MigrationKey[]): T {
	data = structuredClone(data);
	for (const key of keys) {
		const value = data[key.key];

		for (const update of key.updates) {
			// @ts-ignore T is "read-only", yeah sure
			const define = (value: NonNullable<any>) => (data[key.key] = value);

			if (isMigrationOfType<CreateMigration>(update, "create") || isMigrationOfType<OptionsAddDefaultMigration>(update, "options-add"))
				define(update.value);
			else if (isMigrationOfType<RemoveMigration>(update, "remove")) delete data[key.key];
			else if (isMigrationOfType<OptionsRemoveMigration>(update, "options-remove")) {
				for (const option of update.options) {
					const isCurrentValue = option.value === value;
					if (!isCurrentValue) continue;
					define(option.convert_to ?? update.new_default);
				}
			} else if (isMigrationOfType<OptionRenameMigration>(update, "options-rename")) {
				for (const option of update.options) {
					if (option.oldValue !== value) continue;
					define(option.value);
				}
			} else if (isMigrationOfType<ArrOptionsRemoveMigration>(update, "arr-options-remove")) {
				if (!Array.isArray(value)) continue;
				for (const option of update.options) {
					const index = value.indexOf(option.value);
					if (index === -1) continue;
					if (typeof option.convert_to !== "undefined") {
						value[index] = option.convert_to;
						continue;
					}
					value.splice(index, 1);
				}
			} else if (isMigrationOfType<ArrOptionsRenameMigration>(update, "arr-options-rename")) {
				if (!Array.isArray(value)) continue;
				for (const option of update.options) {
					const index = value.indexOf(option.oldValue);
					if (index === -1) continue;
					value[index] = option.value;
				}
			} else if (isMigrationOfType<SetValueMigration>(update, "set-value")) {
				define(update.value);
			} else {
				console.warn("Migration", update.type, "for object property is not known or registered");
			}
		}
	}
	return data;
}

function isMigrationOfType<T extends Migration<MigrationType>>(migration: Migration<MigrationType>, type: T["type"]): migration is T {
	return migration.type === type;
}
