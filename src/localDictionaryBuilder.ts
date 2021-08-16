import { RFC } from './_constants';
import type { DictionaryWord } from "src/integrations/types";
import type DictionaryPlugin from "src/main";
import type { DictionarySettings } from "src/types";

import t from "src/l10n/helpers";
import { Modal, normalizePath, TFile } from "obsidian";

//This really needs a refactor

export default class LocalDictionaryBuilder {
    plugin: DictionaryPlugin;
    settings: DictionarySettings;

    constructor(plugin: DictionaryPlugin) {
        this.plugin = plugin;
        this.settings = plugin.settings;
    }

    private cap(string: string): string {
        const words = string.split(" ");

        return words.map((word) => {
            return word[0].toUpperCase() + word.substring(1);
        }).join(" ");
    }

    async newNote(content: DictionaryWord): Promise<void> {

        const { plugin, settings } = this;

        let phonetics = '';
        content.phonetics.forEach((value, i, a) => {
            phonetics += '- ' + (value.audio ? `<details><summary>${value.text}</summary><audio controls><source src="${value.audio}"></audio></details>` : value.text);
            if (i != a.length - 1) {
                phonetics += '\n';
            }
        });

        let meanings = '';
        content.meanings.forEach((value) => {
            meanings += '### ' + this.cap(value.partOfSpeech) + '\n\n';
            value.definitions.forEach((def, j, b) => {
                meanings += def.definition + '\n\n';
                if (def.example) {
                    meanings += '> ' + def.example + '\n\n';
                }
                if (def.synonyms && def.synonyms.length != 0) {
                    def.synonyms.forEach((syn, i, a) => {
                        meanings += syn;
                        if (i != a.length - 1) {
                            meanings += ', ';
                        }
                    })
                    meanings += '\n\n'
                }
                if (j != b.length - 1) {
                    meanings += '---\n\n';
                }
            });
        });

        let file: TFile;
        const langString = RFC[settings.defaultLanguage];
        const path = `${settings.folder ? settings.folder + '/' : ''}${settings.languageSpecificSubFolders ? langString + '/' : ''}${settings.prefix.replace(/{{lang}}/ig, langString)}${settings.capitalizedFileName ? this.cap(content.word) : content.word}${settings.suffix.replace(/{{lang}}/ig, langString)}.md`;
        const contents = settings.template
            .replace(/{{notice}}/ig, t('Autogenerated by Obsidian Dictionary Plugin'))
            .replace(/{{word}}/ig, settings.capitalizedFileName ? this.cap(content.word) : content.word)
            .replace(/{{pronunciationheader}}/ig, phonetics ? t('Pronunciation') : '')
            .replace(/{{phoneticlist}}/ig, phonetics)
            .replace(/{{meaningheader}}/ig, meanings ? t('Meanings') : '')
            .replace(/{{meanings}}/ig, meanings)
            .replace(/{{lang}}/ig, langString);

        try {
            if(!(await plugin.app.vault.adapter.exists(normalizePath(`${settings.folder ? settings.folder + '/' : ''}${settings.languageSpecificSubFolders ? langString + '/' : ''}`)))) {
                await plugin.app.vault.createFolder(normalizePath(`${settings.folder ? settings.folder + '/' : ''}${settings.languageSpecificSubFolders ? langString + '/' : ''}`));
            }
            file = await plugin.app.vault.create(normalizePath(path), contents);
            const leaf = plugin.app.workspace.splitActiveLeaf();
            await leaf.openFile(file);
            plugin.app.workspace.setActiveLeaf(leaf);
        } catch (error) {
            new OverwriteModal(this.plugin, normalizePath(path), contents).open();
        }
    }
}

class OverwriteModal extends Modal {
    path: string;
    content: string;

    constructor(plugin: DictionaryPlugin, path: string, content: string) {
        super(plugin.app);
        this.path = path;
        this.content = content;
    }

    onOpen() {
        this.contentEl.appendChild(createEl("p", { text: t("A existing File with the same Name was found, do you want to overwrite it?"), cls: "dictionarycenter" }));
        const buttonDiv = this.contentEl.appendChild(createDiv({ cls: "dictionarybuttons" }))
        buttonDiv.appendChild(createEl("button", { text: t("Yes, overwrite the old File."), cls: "mod-cta" })).onClickEvent(async () => {
            await this.app.vault.delete(this.app.vault.getAbstractFileByPath(this.path));
            const file = await this.app.vault.create(this.path, this.content);
            const leaf = this.app.workspace.splitActiveLeaf();
            await leaf.openFile(file);
            this.close();
            this.app.workspace.setActiveLeaf(leaf);
        });
        buttonDiv.appendChild(createEl("button", { text: t("No, keep the old File."), cls: "mod-cta" })).onClickEvent(() => {
            this.close();
        });
    }
}