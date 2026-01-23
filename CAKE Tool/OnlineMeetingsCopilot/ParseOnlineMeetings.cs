using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

public class Script : ScriptBase
{
    public override async Task<HttpResponseMessage> ExecuteAsync()
    {
        // Forward the request to get the response from the backend API
        HttpResponseMessage backendResponse = await this.Context.SendAsync(this.Context.Request, this.CancellationToken).ConfigureAwait(false);
        
        // Only transform if the response was successful
        if (!backendResponse.IsSuccessStatusCode)
        {
            return backendResponse;
        }
        
        // Get the response content from the backend
        var responseString = await backendResponse.Content.ReadAsStringAsync().ConfigureAwait(false);
        
        // Parse the JSON response
        var responseJson = JObject.Parse(responseString);
        
        // Get the value array from the response
        var eventsArray = responseJson["value"] as JArray;
        
        if (eventsArray == null)
        {
            // If no value array found, return empty result
            var emptyResult = new JObject
            {
                ["value"] = new JArray()
            };
            
            var emptyResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = CreateJsonContent(emptyResult.ToString())
            };
            return emptyResponse;
        }
        
        // Filter and transform the events
        var filteredEvents = new JArray();
        
        foreach (var eventItem in eventsArray)
        {
            // Check if isOnlineMeeting is true
            var isOnlineMeeting = eventItem["isOnlineMeeting"];
            if (isOnlineMeeting != null && isOnlineMeeting.Type == JTokenType.Boolean && (bool)isOnlineMeeting)
            {
                // Extract the required properties
                var filteredEvent = new JObject
                {
                    ["subject"] = eventItem["subject"],
                    ["bodyPreview"] = eventItem["bodyPreview"],
                    ["joinUrl"] = eventItem["onlineMeeting"]?["joinUrl"]
                };
                
                filteredEvents.Add(filteredEvent);
            }
        }
        
        // Create the final result object
        var result = new JObject
        {
            ["value"] = filteredEvents
        };
        
        // Create a new response with the filtered data
        var response = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = CreateJsonContent(result.ToString())
        };
        
        return response;
    }
}