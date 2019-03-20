import * as tasks from 'azure-pipelines-task-lib/task';
import {RestClient} from "typed-rest-client/RestClient";
import { getDefaultOctoConnectionInputValue } from "./inputs";
import { either } from "fp-ts";
import OctoApiKeyHandler from "./OctoApiKeyHandler";

export interface OctoServerConnectionDetails {
    url: string;
    apiKey: string;
    ignoreSslErrors: boolean;
}

export function getDefaultOctopusConnectionDetailsOrThrow(){
    let result =  getDefaultOctoConnectionInputValue().map(getOctopusConnectionDetails).toNullable();
    if(!result){
        throw new Error("Could not retrieve default octo connection information");
    }
    return result;
}

export function getOctopusConnectionDetails(name: string): OctoServerConnectionDetails {
    const octoEndpointAuthorization = tasks.getEndpointAuthorization(name, false);
    const ignoreSSL = tasks.getEndpointDataParameter(name, "ignoreSslErrors", true);
    return {
        url: tasks.getEndpointUrl(name, false),
        apiKey: octoEndpointAuthorization.parameters["apitoken"],
        ignoreSslErrors: !!ignoreSSL && ignoreSSL.toLowerCase() === "true"
    }
}

export function fetchProjectName(details: OctoServerConnectionDetails, projectId: string, projectUrlFragment: string){
    console.log("Ignore SSL: " + details.ignoreSslErrors);
    const client = new RestClient(
        "OctoTFS",
        details.url,
        [new OctoApiKeyHandler(details.apiKey)],
        {ignoreSslError: details.ignoreSslErrors});
    return client.get<{Name: string}>(projectUrlFragment)
        .then(x => {
            if(x.result){
                return either.right<string, string>(x.result.Name);
            }

            return either.left<string,string>(`Could not resolve project name given id "${projectId}". Server returned status code: ${x.statusCode}`);
        }
    ).catch(error => either.left<string,string>(error))
}

export const isProjectId = (projectNameOrId: string) => /Projects-\d*/.test(projectNameOrId);

export function resolveProjectName(connection: OctoServerConnectionDetails, projectNameOrId: string){
    if(isProjectId(projectNameOrId)) {
        const projectUrlFragment = `api/projects/${projectNameOrId}`;
        return fetchProjectName(connection, projectNameOrId, projectUrlFragment);
    }

    return Promise.resolve(either.right<string, string>(projectNameOrId));
}

export function resolveProjectNameInSpace(connection: OctoServerConnectionDetails, spaceId: string, projectNameOrId: string){
    if(isProjectId(projectNameOrId)) {
        const projectUrlFragment = `api/${spaceId}/projects/${projectNameOrId}`;
        return fetchProjectName(connection, projectNameOrId, projectUrlFragment);
    }

    return Promise.resolve(either.right<string, string>(projectNameOrId));
}

export function fetchSpaceName(details: OctoServerConnectionDetails, spaceId: string){
    console.log("Ignore SSL: " + details.ignoreSslErrors);
    const client = new RestClient(
        "OctoTFS",
        details.url,
        [new OctoApiKeyHandler(details.apiKey)],
        {ignoreSslError: details.ignoreSslErrors});
    return client.get<{Name: string}>(`api/spaces/${spaceId}`)
        .then(x => {
                if(x.result){
                    return either.right<string, string>(x.result.Name);
                }

                return either.left<string,string>(`Could not resolve space name given id "${spaceId}". Server returned status code: ${x.statusCode}`);
            }
        ).catch(error => either.left<string,string>(error))
}

export const isSpaceId = (spaceNameOrId: string) => /Spaces-\d*/.test(spaceNameOrId);

export function resolveSpaceName(connection: OctoServerConnectionDetails, spaceNameOrId: string){
    if(isSpaceId(spaceNameOrId)) {
        return fetchSpaceName(connection, spaceNameOrId);
    }

    return Promise.resolve(either.right<string, string>(spaceNameOrId));
}